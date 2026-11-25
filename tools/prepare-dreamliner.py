"""Build the offline 787-9 exterior and sound bank. Needs Assimp, NumPy and Pillow."""

import argparse
import json
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
import struct
import subprocess
import tarfile
import urllib.request
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

from dreamliner_paint import apply_livery

REV = "02626b5b659d89b9399943ee167bbb0b46f0c871"
UPSTREAM = f"https://raw.githubusercontent.com/IskenderWang/787-family/{REV}/"
OUTPUT = Path(__file__).resolve().parents[1] / "public/aircraft/787"
SOUNDS = ("turbine", "jet", "whine", "reverser", "roll", "rumble", "touchdown")
MODEL_FILES = ["Models/"+s for s in ("787-9.ac", "787-9.blend", "GEnx.ac", "787-9.png", "GEnx.png",
               "landing-gears.png", "wings.png", "787-9-GEnx.xml", "animation-common.xml", "GEnx.xml",
               "Paintkit/787-9.xcf")]
FILES = ["LICENSE", "Authors.md", *MODEL_FILES, *("Sounds/"+s+".wav" for s in SOUNDS)]


class Glb:
    def __init__(self):
        self.doc = {"asset":{"version":"2.0","generator":"鹭岛飞行 · FlightGear 787-family exterior"},
                    "scene":0,"scenes":[{"nodes":[]}],"nodes":[],"meshes":[],"materials":[],
                    "textures":[],"images":[],"accessors":[],"bufferViews":[],"buffers":[]}
        self.bin = bytearray()

    def accessor(self, values, kind):
        arr = np.ascontiguousarray(values)
        self.bin.extend(b"\0" * (-len(self.bin) % 4))
        views, accessors = self.doc["bufferViews"], self.doc["accessors"]
        views.append({"buffer":0, "byteOffset":len(self.bin), "byteLength":arr.nbytes})
        self.bin.extend(arr.tobytes())
        component = {"f":5126, "H":5123, "I":5125}[arr.dtype.char]
        a = {"bufferView":len(views)-1,"componentType":component,"type":kind,"count":len(arr)}
        if kind == "VEC3":
            a.update(min=arr.min(axis=0).tolist(), max=arr.max(axis=0).tolist())
        accessors.append(a)
        return len(accessors)-1

    def material(self, name, color, roughness, metalness, image=None, emission=None):
        pbr = {"baseColorFactor":[*color,1],"roughnessFactor":roughness,"metallicFactor":metalness}
        if image:
            i = len(self.doc["images"])
            self.doc["images"].append({"uri":image})
            self.doc["textures"].append({"source":i})
            pbr["baseColorTexture"] = {"index":i}
        mat = {"name":name,"pbrMetallicRoughness":pbr, "doubleSided":False}
        if emission:
            mat["emissiveFactor"] = emission
        self.doc["materials"].append(mat)
        return len(self.doc["materials"])-1

    def write(self, path):
        self.bin.extend(b"\0" * (-len(self.bin) % 4))
        self.doc["buffers"] = [{"byteLength":len(self.bin)}]
        blob = json.dumps(self.doc, separators=(",",":")).encode()
        blob += b" " * (-len(blob) % 4)
        path.write_bytes(struct.pack("<4sII", b"glTF", 2, 28+len(blob)+len(self.bin)) +
                         struct.pack("<I4s", len(blob), b"JSON") + blob +
                         struct.pack("<I4s", len(self.bin), b"BIN\0") + self.bin)


def download(cache, name):
    path = cache / name
    if not path.exists():
        path.parent.mkdir(exist_ok=True, parents=True)
        with urllib.request.urlopen(UPSTREAM+name, timeout=60) as response:
            path.write_bytes(response.read())


def import_meshes(cache, file):
    temp = cache / (Path(file).stem + ".assjson")
    subprocess.run(["assimp", "export", str(cache/"Models"/file), str(temp), "-fassjson", "-tri", "-gsn", "-jiv"],
                   check=True, stdout=subprocess.DEVNULL)
    data = json.loads(temp.read_text())
    def descend(node, parents):
        name = node["name"]
        for i in node.get("meshes", []):
            item = data["meshes"][i]
            props = {p["key"]:p["value"] for p in data["materials"][item["materialindex"]]["properties"]}
            xyz = np.array(item["vertices"]).reshape(-1,3)
            normals = np.array(item["normals"]).reshape(-1,3)
            uv = np.array(item["texturecoords"][0]).reshape(-1,2) if "texturecoords" in item else np.zeros((len(xyz),2))
            uv[:,1] = 1-uv[:,1]
            yield (name, parents, props.get("$tex.file", ""), xyz, normals, uv, np.array(item["faces"], np.uint32))
        for child in node.get("children", []):
            yield from descend(child, [*parents,name])
    return list(descend(data["rootnode"], []))


def fg_vector(xml, unit):
    return np.array([float(xml.findtext(k+unit, 0)) for k in ("y","z","x")])


def rotations(cache, prop, family):
    result = {}
    for file in ("animation-common.xml", "787-9-GEnx.xml"):
        for a in ET.parse(cache/"Models"/file).findall(".//animation"):
            if a.findtext("type") != "rotate" or prop not in (a.findtext("property") or ""):
                continue
            axis, center = a.find("axis"), a.find("center")
            if axis is None:
                continue
            if axis.find("x1-m") is not None:
                p = fg_vector(axis, "1-m")
                direction = fg_vector(axis, "2-m")-p
            else:
                p = np.zeros(3) if center is None else fg_vector(center, "-m")
                direction = fg_vector(axis, "")
            norm = np.linalg.norm(direction)
            if norm < 1e-8:
                continue
            keys = [[float(e.findtext("ind")),float(e.findtext("dep"))] for e in a.findall("interpolation/entry")]
            if not keys:
                keys = [[0,0],[1,float(a.findtext("factor",0))]]
            for n in a.findall("object-name"):
                if family(n.text):
                    result[n.text] = (p, direction/norm, keys)
    return result


def basis(v):
    return np.column_stack((-v[:,2], v[:,1], v[:,0]))


def rotate(points, axis, degrees):
    a = np.deg2rad(degrees)
    return points*np.cos(a) + np.cross(axis,points)*np.sin(a) + np.outer(points@axis,axis)*(1-np.cos(a))


def build(cache, fonts):
    body = import_meshes(cache,"787-9.ac")
    engines = import_meshes(cache,"GEnx.ac")
    # Omit alternate emissive skins and hidden rows of internal compressor blades.
    # The visible first-stage blades, stators, spinners, exhaust and cascade stay.
    skip = {"windows-bright","windows-dim","winglts","wings_lightmap","lhfans","rhfans","wing"}
    extents = {name:basis(pos) for name, _, _, pos, *_ in body}
    nose = extents["fuselage"][:,2].min()
    tail = max(extents[k][:,2].max() for k in ("lstab","lhelevator","rudder"))
    bottom = extents["LeftWheelBack"][:,1].min()
    top = max(extents[k][:,1].max() for k in ("fin","rudder"))
    halfspan = abs(extents["lwingc"][:,0]).max()
    scale = np.array([30.06/halfspan,17.02/(top-bottom),62.81/(tail-nose)])
    offset = np.array([0,-5.36-bottom*scale[1],-(tail+nose)*scale[2]/2])
    def world(p):
        return p*scale+offset
    flap_poses = rotations(cache,"flap-pos-norm",lambda n:True)
    spoiler_poses = rotations(cache,"speedbrake-pos-norm",lambda n:True)
    gear_poses = rotations(cache,"position-norm",lambda n:"door" in n or n in ("LeftGear","RightGear","NoseGear"))

    glb = Glb()
    mats = {
        "skin":glb.material("Porcelain paint",(1,1,1),.33,.13,"xiamenair.jpg"),
        "engine":glb.material("GEnx nacelle",(1,1,1),.31,.22,"genx.jpg"),
        "gear":glb.material("Tires, hubs and oleos",(.89,.91,.94),.57,.18,"undercarriage.png"),
        "detail":glb.material("Flap tracks",(1,1,1),.43,.21,"wing-hardware.jpg"),
        "metal":glb.material("Machined aluminium",(.61,.69,.75),.25,.78),
        "paint":glb.material("Antenna fairing",(.88,.93,.97),.31,.15),
        "glass":glb.material("Flight deck glazing",(.033,.071,.098),.115,.48),
        "black":glb.material("Wiper and seals",(.028,.037,.042),.52,.23),
        "red":glb.material("Port navigation",(.75,.025,.012),.24,.16,emission=[1,.025,.008]),
        "green":glb.material("Starboard navigation",(.012,.57,.20),.24,.16,emission=[.01,1,.34]),
        "beacon":glb.material("Anti-collision",(.49,.012,.008),.25,.14,emission=[1,.012,.006]),
        "lamp":glb.material("Landing lamps",(.80,.84,.88),.20,.38,emission=[1,.90,.71]),
    }
    nodes, groups, paint_parts = {}, defaultdict(list), []
    def group(name, center=None, parent=None, **extras):
        if name not in nodes:
            nodes[name] = (np.zeros(3) if center is None else center, parent, extras)
        return name
    structure = group("Airframe")
    wing = group("Wings", kind="wing")
    def hinged(name, pose, **extras):
        pivot, axis, stops = pose
        return group(name, world(pivot), kind="hinge", axis=axis.tolist(), stops=stops, **extras)

    for dataset, is_engine in [(body,False),(engines,True)]:
        for name, parents, texture, pos, normal, uv, faces in dataset:
            if name in skip:
                continue
            xyz = world(basis(pos))
            normal = basis(normal)/scale
            normal /= np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-10)
            key = structure
            mat = {"787-9.png":"skin", "GEnx.png":"engine", "landing-gears.png":"gear",
                   "wings.png":"detail","787-10.png":"paint","Window.png":"glass","BOE-8.png":"black"}.get(texture,"metal")
            if name in ("lhnavlite","rhnavlite"):
                mat = "red" if name[0]=="l" else "green"
            if name in ("lbeaconlenz","ubeaconlenz"):
                mat = "beacon"
            if name in ("llandlt","rlandlt","lhturnofflt","rhturnofflt"):
                mat = "lamp"
            targets = {}
            leg = next((p for p in parents if p in ("LeftGear","RightGear","NoseGear")),None)
            if leg:
                key = hinged(leg,gear_poses[leg], leg=leg)
                if leg == "NoseGear":
                    # The source nose strut is unloaded. Match all three wheel contact planes.
                    xyz[:,1] += (bottom-extents["NoseWheel"][:,1].min())*scale[1]
                if leg != "NoseGear" and ("Wheel" in name or "BaseRod" in name):
                    front = extents[leg.replace("Gear","WheelFront")]
                    back = extents[leg.replace("Gear","WheelBack")]
                    pivot = world((front.max(0)+front.min(0)+back.max(0)+back.min(0))*.25)
                    key = group(leg+"Truck",pivot,leg,kind="truck")
                if "Wheel" in name:
                    center = (xyz.min(0)+xyz.max(0))*.5
                    key = group(name,center,key,kind="wheel",radius=float(np.ptp(xyz[:,1])/2))
            elif "door" in name and name in gear_poses:
                key = hinged(name,gear_poses[name])
            elif is_engine and name.startswith(("eng1fan","eng2fan")):
                prefix = name[:7]
                if name == prefix:
                    center = (xyz.min(0)+xyz.max(0))*.5
                    group(prefix,center,kind="fan")
                key = prefix
            elif is_engine and name in ("lhreverser","rhreverser"):
                key = group(name, kind="reverse")
            elif not is_engine and (name in flap_poses or name in spoiler_poses or
                    (np.abs(xyz[:,0]).max()>5.5 and xyz[:,2].max()<16 and name != "gearbay")):
                key = wing
                amp = np.clip((np.abs(xyz[:,0])-3.0)/27.06,0,1)
                delta = np.zeros_like(xyz)
                delta[:,1] = 2.16*amp**1.88
                slope = np.sign(xyz[:,0])*(2.16*1.88/27.06)*amp**.88
                flex_normal = normal.copy()
                flex_normal[:,0] -= slope*normal[:,1]
                flex_normal /= np.maximum(np.linalg.norm(flex_normal,axis=1,keepdims=True),1e-10)
                targets["flex"] = (delta, flex_normal-normal)
                for label, poses in [("flaps",flap_poses),("spoilers",spoiler_poses)]:
                    if name not in poses:
                        continue
                    hinge, axis, keys = poses[name]
                    angle = keys[-1][1]* (.78 if label=="flaps" else 1)
                    rel = xyz-world(hinge)
                    move = rotate(rel,axis,angle)-rel
                    if label=="flaps" and ("flap" in name or "fairing" in name):
                        move += [0,-.15,.57]
                    if "slat" in name:
                        move += [0,-.12,-.32]
                    targets[label] = (move,rotate(normal,axis,angle)-normal)
            if not is_engine and mat=="skin" and (name.startswith("fuselage") or name in
                    {"fin","rudder","bodyfairing","aftcargodoor","bulkcargodoor","fwdcargodoor","cac","gearbay"} or
                    ("door" in name and name in gear_poses)):
                paint_parts.append((name,xyz,uv,faces))
            groups[(key,mat)].append((xyz-nodes[key][0],normal,uv,faces,targets))

    for name, (center, parent, extras) in nodes.items():
        node = {"name":name, "translation":(center-(nodes[parent][0] if parent else 0)).tolist(), "extras":extras}
        glb.doc["nodes"].append(node)
    node_ids = {k:i for i,k in enumerate(nodes)}
    for name, (_, parent, _) in nodes.items():
        obj = glb.doc["nodes"][node_ids[parent]] if parent else glb.doc["scenes"][0]
        obj.setdefault("children" if parent else "nodes", []).append(node_ids[name])
    triangles = 0
    for (key, mat), pieces in groups.items():
        node = glb.doc["nodes"][node_ids[key]]
        if "mesh" not in node:
            node["mesh"] = len(glb.doc["meshes"])
            glb.doc["meshes"].append({"name":key, "primitives":[]})
        mesh = glb.doc["meshes"][node["mesh"]]
        def attribute(arrays, fmt):
            return glb.accessor(np.vstack(arrays).astype("<f4"),fmt)
        attrs = {field:attribute([p[i] for p in pieces], fmt) for i,field,fmt in
                 [(0,"POSITION","VEC3"),(1,"NORMAL","VEC3"),(2,"TEXCOORD_0","VEC2")]}
        offsets = np.cumsum([0]+[len(p[0]) for p in pieces[:-1]])
        indices = np.concatenate([p[3].ravel()+base for p,base in zip(pieces,offsets)])
        triangles += len(indices)//3
        idx = glb.accessor(indices.astype("<u2" if indices.max()<65536 else "<u4"),"SCALAR")
        primitive = {"attributes":attrs,"material":mats[mat],"indices":idx}
        if key == wing:
            labels = ["flex","flaps","spoilers"]
            mesh.update(weights=[0,0,0],extras={"targetNames":labels})
            primitive["targets"] = [{field:attribute([p[4][label][i] if label in p[4] else
                                      np.zeros_like(p[0]) for p in pieces],"VEC3")
                                      for i,field in enumerate(("POSITION","NORMAL"))} for label in labels]
        mesh["primitives"].append(primitive)
    apply_livery(paint_parts, cache/"Models/787-9.png", OUTPUT/"xiamenair.jpg", fonts)
    for source, target, limit in [("GEnx.png","genx.jpg",2048),("wings.png","wing-hardware.jpg",1024),
                                   ("landing-gears.png","undercarriage.png",512)]:
        im = Image.open(cache/"Models"/source).convert("RGB")
        im.thumbnail((limit,limit),Image.Resampling.LANCZOS)
        im.save(OUTPUT/target,quality=94,subsampling=0,optimize=True)
    glb.write(OUTPUT/"dreamliner.glb")
    print(f"{triangles:,} exterior triangles; {len(groups)} primitives")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", required=True, type=Path)
    parser.add_argument("--fonts", type=Path, default=Path("/System/Library/Fonts/Supplemental"))
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(6) as pool:
        list(pool.map(lambda f:download(args.cache,f), FILES))
    build(args.cache, args.fonts)
    sound_dir = OUTPUT/"sounds"
    sound_dir.mkdir(exist_ok=True)
    for name in SOUNDS:
        shutil.copyfile(args.cache/"Sounds"/(name+".wav"),sound_dir/(name+".wav"))
    for name in ("LICENSE","Authors.md"):
        shutil.copyfile(args.cache/name,OUTPUT/name)
    # The editable source and exact conversion scripts are available with the build.
    # These files are never fetched during a flight.
    with tarfile.open(OUTPUT/"model-source.tar.xz","w:xz",preset=4) as archive:
        for name in ["LICENSE","Authors.md",*MODEL_FILES]:
            archive.add(args.cache/name,arcname=name)
        for name in ("prepare-dreamliner.py","dreamliner_paint.py"):
            archive.add(Path(__file__).with_name(name),arcname="tools/"+name)

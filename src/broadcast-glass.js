export const curtainStorey=3.73, curtainDatum=41.05;

// A reflection probe for the lake-facing curtain wall. Its transparent sky is
// replaced by the same weather panoramas, sun bearing and clock as the sky dome.
export const facadeSkyGLSL = `
uniform sampler2D facadeView, facadeDay, facadeBlue, facadeCloud;
uniform vec3 facadeSun, facadeHaze;
uniform float facadeTime, facadeCover, facadeMist, facadeDusk, facadeNight;

vec4 vistaLayer(vec2 uv, float layer) {
  vec2 gradX=dFdx(uv), gradY=dFdy(uv);
  gradX.x-=floor(gradX.x+.5);
  gradY.x-=floor(gradY.x+.5);
  vec2 scale=vec2(1.,126./768.);
  vec2 st=vec2(uv.x,(layer*128.+1.+clamp(uv.y,0.,1.)*126.)/768.);
  return textureGrad(facadeView,st,gradX*scale,gradY*scale);
}
vec3 facadeRadiance(vec3 ray, float height) {
  float az=atan(ray.z,ray.x), el=asin(clamp(ray.y,-1.,1.));
  float u=fract((az-atan(facadeSun.z,facadeSun.x))/6.2831853+.600);
  float drift=facadeTime*.000024, v=clamp(el/3.14159265+.5,.507,.999);
  vec3 gold=texture2D(facadeDay,vec2(fract(u+drift),v),.85).rgb;
  vec3 cloud=texture2D(facadeCloud,vec2(fract(u+drift+.16),v),.85).rgb;
  vec3 blue=texture2D(facadeBlue,vec2(fract(u+drift*.65),v),.85).rgb;
  float warm=(1.-smoothstep(.12,.48,facadeSun.y))*(1.-facadeNight);
  gold*=mix(vec3(1.),vec3(1.26,.85,.68),warm*.60);
  vec3 air=mix(gold,cloud,clamp(.57*facadeCover+.46*smoothstep(.16,.55,facadeSun.y),0.,1.));
  air=mix(air,blue,.88*facadeDusk);
  air=mix(air,vec3(.028,.044,.078)*mix(1.,.62,smoothstep(.01,.82,ray.y)),facadeNight);
  air=mix(air,facadeHaze,.52*facadeMist);

  vec2 uv=vec2(fract(az/6.2831853+.5),(degrees(el)+86.)/148.);
  float slice=clamp((height-14.)/42.,0.,1.9999), k=floor(slice), t=fract(slice);
  vec4 site=mix(vistaLayer(uv,k),vistaLayer(uv,k+1.),t);
  if(facadeNight>.002){
    vec4 lit=mix(vistaLayer(uv,k+3.),vistaLayer(uv,k+4.),t);
    site.rgb=mix(site.rgb,lit.rgb,facadeNight);
  }
  site.rgb*=mix(vec3(.97,1.02,1.04),vec3(1.13,.91,.78),.49*warm);
  float land=site.a*(1.-smoothstep(59.,62.,degrees(el)));
  float sun=pow(max(0.,dot(ray,facadeSun)),66.)*(1.-facadeCover*.66)*(1.-facadeNight);
  return mix(air+sun*vec3(.44,.27,.13),site.rgb,land);
}`;

export const curtainWallGLSL = `
if(abs(kind-43.)<.25){
  vec2 panel=surfaceUV/vec2(1.16,.87);
  float joint=max(lightLine(panel.x,.013),lightLine(panel.y,.018));
  float grain=shash(floor(panel)+seed*79.);
  float visible=1.-smoothstep(.22,1.05,max(fwidth(panel.x),fwidth(panel.y)));
  diffuseColor.rgb*=(.990+.087*(grain-.5)*visible)*(1.-.24*joint);
  float sconce=exp(-.12*surfaceUV.y)*(.5+.5*cos(surfaceUV.x*1.21));
  accent=sceneryDarkness*(vec3(.042,.043,.038)+vec3(.35,.233,.112)*sconce);
}
if(abs(kind-50.)<.25){
  float rib=lightLine(surfaceUV.x/.68,.021), end=lightLine(surfaceUV.y/4.52,.010);
  float rolled=sin(surfaceUV.x*9.24)*(.032*(1.-smoothstep(.12,.67,fwidth(surfaceUV.x))));
  diffuseColor.rgb*=.94+.10*rib-.08*end+rolled;
  if(seed<.6){
    float wallDistance=length(max(vec2(-surfaceUV.x,surfaceUV.y),vec2(0.)));
    diffuseColor.rgb*=1.-.21*exp(-wallDistance*1.12);
  }
}
if(abs(kind-51.)<.25){
  float flute=lightLine(surfaceUV.x/.37,.076), sheet=lightLine(surfaceUV.x/1.48,.018);
  diffuseColor.rgb*=1.02-.23*flute-.15*sheet;
}
if(abs(kind-52.)<.25){
  vec3 n=normalize(sceneNormal), view=normalize(cameraPosition-scenePos);
  float sky=clamp(reflect(-view,n).y*.65+.34,0.,1.);
  accent=vec3(.012,.025,.037)*sky*(1.-sceneryDarkness)
        +sceneryDarkness*smoothstep(.53,.97,seed)*mix(vec3(.25,.146,.071),vec3(.13,.196,.212),step(.86,seed));
}
if(abs(kind-38.)<.25){
  vec2 cell=vec2(surfaceUV.x,(surfaceUV.y-${curtainDatum})/${curtainStorey}), q=fract(cell), panel=floor(cell);
  vec2 aa=clamp(fwidth(cell)*.56,vec2(.008),vec2(.24));
  float detail=1.-smoothstep(.18,.88,max(fwidth(cell.x),fwidth(cell.y)));
  float randomPane=shash(panel+seed*41.7);
  float floorEdge=lightLine(cell.y,.020), joint=lightLine(cell.x,.011);
  float transom=lightLine(cell.y-.402,.016);
  float clearPane=smoothstep(21.55,22.1,surfaceUV.y);
  float frame=clamp(.92*floorEdge+.76*transom+.16*joint,0.,1.)*clearPane;
  float lowerSeam=max(joint,lightLine(surfaceUV.y/2.46,.011));
  vec3 n=normalize(sceneNormal), tangent=normalize(vec3(n.z,0.,-n.x));
  vec3 view=normalize(cameraPosition-scenePos);
  n=normalize(n+tangent*(randomPane-.5)*.012*detail
              +vec3(0.,.009*(q.y-.5)+.011*(shash(vec2(panel.y,seed))-.5),0.)*detail);
  vec3 ray=reflect(-view,n);
  vec3 incoming=facadeRadiance(ray,scenePos.y);
  // The west sky lights the glass viewed from the entrance. From the lake,
  // the same panes turn towards the cooler part of the reflected sky.
  vec2 bearing=ray.xz/max(.001,length(ray.xz)), solar=facadeSun.xz/max(.001,length(facadeSun.xz));
  float brightSky=smoothstep(.26,.97,dot(bearing,solar));
  float clearSky=(1.-facadeNight)*(1.-.70*facadeCover)*(1.-.76*facadeMist);
  vec3 daylight=mix(vec3(.34,.43,.59),vec3(1.0,1.28,1.19),brightSky);
  daylight*=mix(1.05,.81,smoothstep(.30,.90,ray.y));
  incoming*=mix(vec3(1.),daylight,clearSky);
  float fresnel=.49+.38*pow(1.-abs(dot(n,view)),2.4);
  float edgeShade=.82+.18*smoothstep(0.,4.,surfaceUV.x);
  vec3 coating=mix(vec3(.005,.077,.171),vec3(.010,.099,.198),smoothstep(19.,84.,surfaceUV.y));
  float azure=shash(vec2(floor(cell.x),seed+5.3))-.5;
  coating.gb*=vec2(1.+.145*azure*detail,1.-.075*azure*detail);
  coating*=edgeShade*(.91+.18*randomPane*detail);
  coating=mix(vec3(.008,.080,.132)*(1.-.17*lowerSeam),coating,clearPane);
  coating*=mix(vec3(1.),daylight,clearSky);
  diffuseColor.rgb=mix(coating,vec3(.40,.51,.54),frame);
  float span=2.+floor(shash(vec2(panel.y,seed+6.))*2.95);
  float suite=shash(vec2(floor((cell.x+shash(vec2(panel.y,seed))*2.)/span),panel.y)+seed*23.);
  float room=normBand(.065,.935,q.x,aa.x)*normBand(.105,.87,q.y,aa.y);
  float blindHeight=.25+.37*shash(vec2(floor(cell.x*.55),panel.y)+seed);
  float blind=smoothstep(blindHeight-aa.y,blindHeight+aa.y,q.y);
  // Project interior partitions onto the inner pane. The wall moves behind the
  // mullions as the aircraft passes, and stays attached to its office floor.
  float parallax=clamp(dot(view,tangent)/max(.30,abs(dot(view,n))),-1.8,1.8);
  float roomWall=lightLine((cell.x+parallax*(1.-q.y)*.63)/2.46+.23,.051);
  float ceiling=normBand(.68,.80,q.y,aa.y);
  float recess=(.47+.37*blind+.16*ceiling)*(1.-.51*roomWall);
  float occupants=smoothstep(.46,.96,suite)*(.55+.45*randomPane);
  float lit=mix(.048,room*occupants*recess,detail)*clearPane;
  vec3 lighting=mix(vec3(.41,.238,.105),vec3(.175,.249,.27),smoothstep(.42,.94,shash(vec2(panel.y,seed+6.))));
  glass=.59*(1.-frame);
  accent=(incoming*mix(vec3(.072,.255,.43),vec3(.19,.42,.59),fresnel)*(.70+fresnel*.42)*mix(.70,1.,clearPane)
         +sceneryDarkness*(lit*lighting+vec3(.006,.019,.032)))*(1.-.94*frame);
}`;

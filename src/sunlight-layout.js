import plan from './gulangyu-plan.json' with { type: 'json' };

export const sunlight = plan.sunlight;
export const summitLevel = 92.7;
export const eastLandingLevel = 85.28;
export const slabLandingLevel = 81.9;
export const summitPoint = sunlight.lookout.reduce(
  (sum, p) => [sum[0]+p[0]/sunlight.lookout.length, sum[1]+p[1]/sunlight.lookout.length], [0, 0]
);

/**
 * Track services exports
 */

// Coordinate transformation
export {
  calculateGeoBounds,
  calculateBoundsFromTrajectory,
  mergeGeoBounds,
  createCoordinateTransform,
  transformTrajectoryToSvg,
} from './coordinateTransform';

// Frenet coordinate transformations
export {
  createReferenceLine,
  toFrenet,
  fromFrenet,
  toFrenetBatch,
  fromFrenetBatch,
  interpolateAtDistance,
  getHeadingAtDistance,
  type Point2D,
  type FrenetPoint,
  type ReferenceLine,
  type ReferenceLinePoint,
} from './frenetTransform';

// Boundary generation from telemetry
export {
  generateBoundariesFromTrajectories,
  generateOffsetBoundary,
  mergeBoundaries,
  addTrajectoryToBoundary,
  isBoundaryQualitySufficient,
  type BoundarySegment,
  type ComputedTrackBoundary,
  type BoundaryGeneratorOptions,
} from './boundaryGenerator';

// Deviation analysis
export {
  analyzeTrajectoryDeviation,
  detectBoundaryViolations,
  getDeviationColor,
} from './deviationAnalysis';

// Corner analysis
export { detectCorners, type Corner } from './cornerAnalysis';

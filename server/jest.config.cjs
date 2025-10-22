const { createDefaultPreset } = require('ts-jest');

const tsJestPreset = createDefaultPreset();

module.exports = {
  ...tsJestPreset,
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  collectCoverageFrom: ['src/**/*.ts']
};

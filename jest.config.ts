import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  moduleNameMapper: {
    '@openshift-console/dynamic-plugin-sdk':
      '<rootDir>/src/__mocks__/@openshift-console/dynamic-plugin-sdk.ts',
  },
};

export default config;

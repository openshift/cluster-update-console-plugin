import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '@openshift-console/dynamic-plugin-sdk':
      '<rootDir>/src/__mocks__/@openshift-console/dynamic-plugin-sdk.ts',
    '\\.(css|less|scss)$': '<rootDir>/src/__mocks__/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
      },
    },
  },
};

export default config;

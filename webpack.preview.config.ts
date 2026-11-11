import * as path from 'path';
import type { Configuration } from 'webpack-dev-server';
import type { Configuration as WebpackConfiguration } from 'webpack';

const config: WebpackConfiguration & { devServer: Configuration } = {
  mode: 'development',
  entry: './src/preview/index.tsx',
  output: { path: path.resolve(__dirname, 'dist-preview'), filename: 'preview.js' },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@openshift-console/dynamic-plugin-sdk$': path.resolve(
        __dirname,
        'src/preview/console-sdk.tsx',
      ),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: { loader: 'ts-loader', options: { transpileOnly: true } },
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(svg|woff2?|ttf|eot|png)$/, type: 'asset/resource' },
    ],
  },
  devServer: {
    host: '127.0.0.1',
    port: 9002,
    static: [
      { directory: path.resolve(__dirname, 'src/preview') },
      { directory: path.resolve(__dirname, 'locales'), publicPath: '/locales' },
    ],
    hot: true,
  },
};

export default config;

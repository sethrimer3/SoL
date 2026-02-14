const path = require('path');
const fs = require('fs');
require('dotenv').config({ quiet: true });
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');


class CopyStaticAssetsPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('CopyStaticAssetsPlugin', () => {
      const sourceAssetsPath = path.resolve(__dirname, 'ASSETS');
      const destinationAssetsPath = path.resolve(__dirname, 'dist', 'ASSETS');
      fs.cpSync(sourceAssetsPath, destinationAssetsPath, { recursive: true, force: true });
    });
  }
}

module.exports = {
  entry: './src/main.ts',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  performance: {
    hints: 'warning',
    maxAssetSize: 800 * 1024,
    maxEntrypointSize: 800 * 1024,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      title: 'SoL - Speed of Light RTS',
    }),
    // Inject environment variables at build time
    new CopyStaticAssetsPlugin(),
    new webpack.DefinePlugin({
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || '')
    }),
  ],
};

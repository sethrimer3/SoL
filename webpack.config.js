const path = require('path');
const fs = require('fs');
require('dotenv').config({ quiet: true });
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const DEFAULT_SUPABASE_URL = 'https://ixweicxojgtcpajnfrww.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4d2VpY3hvamd0Y3Bham5mcnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1OTU4MzEsImV4cCI6MjA4NjE3MTgzMX0.ZuChgOFQf-ouThReLwlqAj3ZzcvZF8r0b78bu_CQcVc';


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
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY)
    }),
  ],
};

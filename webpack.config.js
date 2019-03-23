const webpack = require('webpack');
const DefinePlugin = require("webpack/lib/DefinePlugin");

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    return {
        entry: {
            'map-breaker': './index.js'
        },
        output: {
            path: __dirname + '/dist',
            publicPath: 'dist',
            filename: '[name].js',
            globalObject: 'this'
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: [ 'babel-loader' ]
                }
            ]
        },
        resolve: {
            extensions: ['*', '.js', '.jsx']
        },
        plugins: [
            new DefinePlugin({
                '__DEVELOPMENT__': !isProduction
            }),
            ...(
                isProduction
                ? [ ]
                : [ new webpack.HotModuleReplacementPlugin() ]
            )
        ],
        devServer: isProduction
            ? undefined
            : {
                port: 8085,
                contentBase: './',
                hot: true
            },
        devtool: isProduction ? undefined : 'eval'
    }
};

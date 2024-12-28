module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    transform: {
        '^.+\\.js$': ['babel-jest', {
        presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }]
        ]
        }]
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(jest-chrome)/)'
    ],
    moduleNameMapper: {
        '^chrome$': 'jest-chrome'
    },
    testMatch: [
        '**/tests/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    verbose: true
};

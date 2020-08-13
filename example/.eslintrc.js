module.exports = {
    root: true,
    extends: ['@react-native-community', 'prettier'],
    plugins: ['jest', 'react-hooks'],
    env: {
        'jest/globals': true
    },
    rules: {
        'react-hooks/rules-of-hooks': 'error', // Checks rules of Hooks
        'react-hooks/exhaustive-deps': 'warn' // Checks effect dependencies
    }
};

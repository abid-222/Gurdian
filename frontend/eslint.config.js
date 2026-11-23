import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import hooks from 'eslint-plugin-react-hooks'
export default [
  { ignores: ['dist'] }, js.configs.recommended,
  { files: ['**/*.{js,jsx}'], languageOptions: { globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } }, sourceType: 'module' },
    plugins: { react, 'react-hooks': hooks }, settings: { react: { version: '18' } },
    rules: { ...react.configs.recommended.rules, ...hooks.configs.recommended.rules, 'react/prop-types': 'off', 'react/react-in-jsx-scope': 'off', 'react/no-unescaped-entities': 'off' } },
]

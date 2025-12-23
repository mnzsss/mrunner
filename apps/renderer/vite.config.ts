import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import packageJson from './package.json'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: [['babel-plugin-react-compiler', { target: '19' }]],
			},
		}),
		tailwindcss(),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@mrunner/ui': path.resolve(__dirname, '../../packages/ui/src'),
		},
	},
	define: {
		__APP_VERSION__: JSON.stringify(packageJson.version),
	},
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			ignored: ['**/apps/launcher/**', '**/target/**'],
		},
	},
	envPrefix: ['VITE_', 'TAURI_'],
	build: {
		outDir: '../../dist',
		emptyOutDir: true,
		target:
			process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
		minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
		sourcemap: !!process.env.TAURI_ENV_DEBUG,
	},
})

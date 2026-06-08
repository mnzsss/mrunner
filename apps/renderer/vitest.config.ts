import path from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config'

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			globals: true,
			environment: 'jsdom',
			setupFiles: ['./src/test/setup.ts'],
			include: ['src/**/*.{test,spec}.{ts,tsx}'],
			clearMocks: true,
			restoreMocks: true,
		},
		resolve: {
			alias: {
				'@': path.resolve(__dirname, './src'),
				'@mrunner/ui/ai-elements': path.resolve(
					__dirname,
					'../../packages/ui/src/components/ai-elements',
				),
				'@mrunner/ui': path.resolve(__dirname, '../../packages/ui/src'),
			},
		},
	}),
)

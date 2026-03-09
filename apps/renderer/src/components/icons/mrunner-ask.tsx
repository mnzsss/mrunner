import type { SVGProps } from 'react'

export function MRunnerAskIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			{...props}
		>
			{/* Command prompt base */}
			<path d="M5 9l3 3-3 3" />
			<line x1="10" y1="15" x2="15" y2="15" />
			{/* Sparkle — AI augmented */}
			<path d="M19 3v4M17 5h4" />
			<circle cx="19" cy="5" r="0.5" fill="currentColor" stroke="none" />
			{/* Container */}
			<rect x="2" y="3" width="16" height="16" rx="2" />
		</svg>
	)
}

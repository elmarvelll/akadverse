/** PIP's own vector avatar: crisp at launcher, message and welcome sizes. */
export function PipAvatar({ className = "" }: { className?: string }) {
  return <svg className={`pip-avatar ${className}`} viewBox="0 0 96 96" role="img" aria-label="PIP robot">
    <circle cx="48" cy="48" r="46" fill="#edf2ff" />
    <path d="M27 80c2-15 40-15 42 0" fill="#bdd0ff" stroke="#6289ec" strokeWidth="2" />
    <path d="M48 15v9" stroke="#3669eb" strokeWidth="3" strokeLinecap="round" /><circle cx="48" cy="13" r="4" fill="#6786ff" />
    <rect x="17" y="36" width="10" height="24" rx="5" fill="#4776ee" /><rect x="69" y="36" width="10" height="24" rx="5" fill="#4776ee" />
    <rect x="24" y="24" width="48" height="45" rx="20" fill="white" stroke="#a6bdf7" strokeWidth="2" />
    <rect x="29" y="31" width="38" height="29" rx="13" fill="#102b63" />
    <path d="M35 43q4-7 8 0m10 0q4-7 8 0" fill="none" stroke="#8de5ff" strokeWidth="3" strokeLinecap="round" />
    <path d="M43 50q5 5 10 0" fill="none" stroke="#8de5ff" strokeWidth="2.5" strokeLinecap="round" />
    <ellipse cx="37" cy="29" rx="6" ry="2" fill="#e9f1ff" />
  </svg>;
}

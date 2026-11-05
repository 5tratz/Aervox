export function AppLoadingScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="h-10 w-10 text-primary animate-[rock_2s_ease-in-out_infinite]"
          fill="currentColor"
        >
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium tracking-wide text-foreground">
          Loading<span className="inline-flex w-4 justify-start"><Dots /></span>
        </p>
        <p className="text-xs text-muted-foreground">Aervox</p>
      </div>
      <style>{`
        @keyframes rock {
          0%, 100% { transform: rotate(-8deg) translateY(0); }
          50%      { transform: rotate(8deg) translateY(-2px); }
        }
      `}</style>
    </div>
  )
}

function Dots() {
  return (
    <span className="ml-0.5 inline-flex gap-0.5">
      <span className="animate-[dot_1.4s_ease-in-out_infinite] [animation-delay:0ms]">.</span>
      <span className="animate-[dot_1.4s_ease-in-out_infinite] [animation-delay:200ms]">.</span>
      <span className="animate-[dot_1.4s_ease-in-out_infinite] [animation-delay:400ms]">.</span>
      <style>{`
        @keyframes dot {
          0%, 80%, 100% { opacity: 0.2; }
          40%           { opacity: 1; }
        }
      `}</style>
    </span>
  )
}
const P: Record<string, string> = {
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5zM5 19h14",
  film: "M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4",
  palette: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5S13 18 13 17s.8-1.5 2-1.5h2a4 4 0 0 0 4-4C21 6.8 17 3 12 3zM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  shapes: "M4 14h7v7H4zM17.5 3l4 7h-8zM17.5 14a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM4 3h7v7H4z",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  export: "M12 4v12M7 11l5 5 5-5M4 20h16",
  play: "M7 4l13 8-13 8z",
  pause: "M7 4h3v16H7zM14 4h3v16h-3z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  plug: "M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5",
};
export function Icon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name]} />
    </svg>
  );
}

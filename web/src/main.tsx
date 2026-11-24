import { createRoot } from "react-dom/client";
import "@fontsource/anton/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/500.css";
import "@fontsource/oswald/700.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./styles.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register("/sw.js");


  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  // @ts-ignore: side-effect import for CSS
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App/>);
  
import React from "react";
import ReactDOM from "react-dom/client";
import PharmacieApp from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div style={{ padding: 20, maxWidth: 1300, margin: "0 auto" }}>
      <PharmacieApp />
    </div>
  </React.StrictMode>
);

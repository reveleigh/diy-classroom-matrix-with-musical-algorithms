import { Metadata } from "next";
import LEDMatrixDashboard from "./LEDMatrixDashboard";

export const metadata: Metadata = {
  title: "LED Matrix Project",
  description: "Custom 480 LED matrix with audio",
};

export default function LEDMatrixPage() {
  return <LEDMatrixDashboard />;
}
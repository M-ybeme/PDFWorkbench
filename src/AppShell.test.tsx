import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import AppShell from "./components/AppShell";

const renderWithRouter = () => {
  render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<div>Home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

describe("AppShell", () => {
  it("shows navigation links for planned tools", () => {
    renderWithRouter();
    expect(screen.getByText(/PDF Viewer/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Merge/i).length).toBeGreaterThan(0);
  });
});

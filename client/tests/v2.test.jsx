import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import AdminPage from "../src/components/AdminPage.jsx";

vi.mock("../src/api.js");

const PROMPT = (role) => ({ systemPrompt: `${role} prompt`, temperature: 0.4, maxTokens: 300 });
const CONFIG = {
  version: "v1",
  prompts: { principal: PROMPT("principal"), teacher: PROMPT("teacher") },
  schoolRows: 24,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AdminPage", () => {
  beforeEach(() => api.getAdminConfig.mockResolvedValue(CONFIG));

  it("V1 hides the V2 options", async () => {
    render(<AdminPage />);
    await screen.findByText("Data source");
    expect(screen.getByRole("button", { name: "V1 (current)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/school_review/)).not.toBeInTheDocument();
  });

  it("switching to V2 saves it and shows the school DB info", async () => {
    api.saveAdminConfig.mockResolvedValue({ ...CONFIG, version: "v2" });
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "V2" }));
    expect(api.saveAdminConfig).toHaveBeenCalledWith({ version: "v2" });
    expect(await screen.findByText(/school_review/)).toBeInTheDocument();
  });

  it("edits temperature / max tokens / prompt and saves them", async () => {
    api.saveAdminConfig.mockResolvedValue(CONFIG);
    render(<AdminPage />);
    const save = await screen.findByRole("button", { name: "Save prompts" });
    expect(save).toBeDisabled(); // nothing changed yet
    const tokens = screen.getByLabelText("teacher max tokens");
    await userEvent.clear(tokens);
    await userEvent.type(tokens, "250");
    expect(save).toBeEnabled();
    await userEvent.click(save);
    await waitFor(() => expect(api.saveAdminConfig).toHaveBeenCalled());
    const sent = api.saveAdminConfig.mock.calls[0][0];
    expect(sent.prompts.teacher.maxTokens).toBe(250);
    expect(sent.prompts.principal.maxTokens).toBe(300);
  });

  it("shows the server's error", async () => {
    api.saveAdminConfig.mockRejectedValue(new Error("teacher: temperature must be between 0 and 2"));
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "V2" }));
    expect(await screen.findByRole("status")).toHaveTextContent("temperature must be between");
  });
});


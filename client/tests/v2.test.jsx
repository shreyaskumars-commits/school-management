import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import App from "../src/App.jsx";
import AdminPage from "../src/components/AdminPage.jsx";

vi.mock("../src/api.js");

const PROMPT = (role) => ({ systemPrompt: `${role} prompt`, temperature: 0.4, maxTokens: 300 });
const CONFIG = {
  version: "v1",
  v2Source: "db",
  prompts: { principal: PROMPT("principal"), teacher: PROMPT("teacher") },
  excel: { fileName: null, uploadedAt: null, rows: 0 },
  schoolRows: 24,
};
const ASHA = { id: 101, name: "Asha", department: "CSE", year: 2 };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AdminPage", () => {
  beforeEach(() => api.getAdminConfig.mockResolvedValue(CONFIG));

  it("V1 hides the V2 options", async () => {
    render(<AdminPage />);
    await screen.findByText("Data source");
    expect(screen.getByRole("button", { name: "V1 (current)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Excel file")).not.toBeInTheDocument();
  });

  it("switching to V2 saves it and shows the DB / Excel toggle", async () => {
    api.saveAdminConfig.mockResolvedValue({ ...CONFIG, version: "v2" });
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "V2" }));
    expect(api.saveAdminConfig).toHaveBeenCalledWith({ version: "v2" });
    expect(await screen.findByRole("button", { name: "Connect to school DB" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Excel mode shows upload, and uploading sends the file", async () => {
    api.getAdminConfig.mockResolvedValue({ ...CONFIG, version: "v2", v2Source: "excel" });
    api.uploadExcel.mockResolvedValue({
      ...CONFIG, version: "v2", v2Source: "excel",
      excel: { fileName: "school.xlsx", uploadedAt: "x", rows: 24 },
    });
    const { container } = render(<AdminPage />);
    await screen.findByText(/No file uploaded yet/);
    const file = new File(["x"], "school.xlsx");
    await userEvent.upload(container.querySelector('input[type="file"]'), file);
    expect(api.uploadExcel).toHaveBeenCalledWith(file);
    expect(await screen.findByText(/24 rows from school.xlsx/)).toBeInTheDocument();
  });

  it("edits temperature / max tokens / prompt and saves them", async () => {
    api.saveAdminConfig.mockResolvedValue(CONFIG);
    render(<AdminPage />);
    const save = await screen.findByRole("button", { name: "Save prompts" });
    expect(save).toBeDisabled();
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

describe("teacher remark button", () => {
  beforeEach(() => api.getStudents.mockResolvedValue({ total: 1, data: [ASHA] }));

  it("is disabled when remarks are off", async () => {
    api.getConfig.mockResolvedValue({ version: "v2", source: "excel", remarksEnabled: false });
    render(<App role="teacher" />);
    await screen.findByText("Asha");
    expect(screen.getByRole("button", { name: "Add remark" })).toBeDisabled();
  });

  it("adds a remark when V2 is connected to the DB", async () => {
    api.getConfig.mockResolvedValue({ version: "v2", source: "db", remarksEnabled: true });
    api.addRemark.mockResolvedValue({});
    render(<App role="teacher" />);
    await screen.findByText("Asha");
    const button = screen.getByRole("button", { name: "Add remark" });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await userEvent.type(screen.getByLabelText("Remark"), "Great viva");
    await userEvent.click(screen.getByRole("button", { name: "Save remark" }));
    await waitFor(() =>
      expect(api.addRemark).toHaveBeenCalledWith({ studentId: 101, rating: 3, comment: "Great viva" }),
    );
    expect(await screen.findByText("Remark added")).toBeInTheDocument();
  });

  it("principal has no remark button", async () => {
    render(<App role="principal" />);
    await screen.findByText("Asha");
    expect(screen.queryByRole("button", { name: "Add remark" })).not.toBeInTheDocument();
  });
});

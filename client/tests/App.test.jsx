import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import App from "../src/App.jsx";

vi.mock("../src/api.js");

const ASHA = { id: 101, name: "Asha", department: "CSE", year: 2 };

beforeEach(() => {
  vi.resetAllMocks();
  api.getStudents.mockResolvedValue({ total: 1, data: [ASHA] });
});

it("lists students from the api", async () => {
  render(<App />);
  expect(await screen.findByText("Asha")).toBeInTheDocument();
  expect(screen.getByText("(1)")).toBeInTheDocument();
});

it("adds a student through the form", async () => {
  api.createStudent.mockResolvedValue({});
  render(<App />);
  await screen.findByText("Asha");
  await userEvent.type(screen.getByLabelText("Name"), "Zed");
  await userEvent.type(screen.getAllByLabelText("Department")[0], "MECH");
  await userEvent.click(screen.getByRole("button", { name: "Add student" }));
  await waitFor(() =>
    expect(api.createStudent).toHaveBeenCalledWith({
      name: "Zed",
      department: "MECH",
      year: 1,
    }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent("Student added");
});

it("edits a student: Edit prefills the form, save PATCHes it", async () => {
  api.updateStudent.mockResolvedValue({});
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  expect(screen.getByLabelText("Name")).toHaveValue("Asha");
  await userEvent.clear(screen.getByLabelText("Name"));
  await userEvent.type(screen.getByLabelText("Name"), "Asha K");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(api.updateStudent).toHaveBeenCalledWith(101, {
      name: "Asha K",
      department: "CSE",
      year: 2,
    }),
  );
  // back to add mode
  expect(await screen.findByText("Add student", { selector: "h2" })).toBeInTheDocument();
});

it("deletes only after confirmation", async () => {
  api.deleteStudent.mockResolvedValue(null);
  const confirm = vi.spyOn(window, "confirm");
  render(<App />);
  await screen.findByText("Asha");

  confirm.mockReturnValueOnce(false);
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(api.deleteStudent).not.toHaveBeenCalled();

  confirm.mockReturnValueOnce(true);
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(api.deleteStudent).toHaveBeenCalledWith(101));
  expect(await screen.findByRole("status")).toHaveTextContent("Deleted Asha");
});

it("shows a server error in the form message", async () => {
  api.createStudent.mockRejectedValue(new Error("year must be a whole number from 1 to 4"));
  render(<App />);
  await screen.findByText("Asha");
  await userEvent.type(screen.getByLabelText("Name"), "Zed");
  await userEvent.type(screen.getAllByLabelText("Department")[0], "MECH");
  await userEvent.click(screen.getByRole("button", { name: "Add student" }));
  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("year must be a whole number from 1 to 4");
  expect(status).toHaveClass("error");
});

it("filters by department with the typed text", async () => {
  render(<App />);
  await screen.findByText("Asha");
  await userEvent.type(screen.getByPlaceholderText("e.g. CSE"), "IT");
  await waitFor(() =>
    expect(api.getStudents).toHaveBeenLastCalledWith({
      page: 1,
      limit: 5,
      department: "IT",
    }),
  );
});


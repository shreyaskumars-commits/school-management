import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Pager from "../src/components/Pager.jsx";
import StudentForm from "../src/components/StudentForm.jsx";
import StudentTable from "../src/components/StudentTable.jsx";

const ASHA = { id: 101, name: "Asha", department: "CSE", year: 2 };

describe("StudentTable", () => {
  it("shows a row per student", () => {
    render(<StudentTable students={[ASHA]} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Year 2")).toBeInTheDocument();
  });

  it("shows an empty message", () => {
    render(<StudentTable students={[]} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("No students found")).toBeInTheDocument();
  });

  it("passes the student to the edit and delete handlers", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<StudentTable students={[ASHA]} onEdit={onEdit} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onEdit).toHaveBeenCalledWith(ASHA);
    expect(onDelete).toHaveBeenCalledWith(ASHA);
  });
});

describe("Pager", () => {
  it("disables Previous on the first page", () => {
    render(<Pager page={1} totalPages={3} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("disables Next on the last page and calls onChange", async () => {
    const onChange = vi.fn();
    render(<Pager page={3} totalPages={3} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe("StudentForm", () => {
  it("submits typed values with a numeric year, then clears", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<StudentForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "Zed");
    await userEvent.type(screen.getByLabelText("Department"), "MECH");
    await userEvent.selectOptions(screen.getByLabelText("Year"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Zed",
      department: "MECH",
      year: 3,
    });
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("keeps the values when the submit fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(<StudentForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "Zed");
    await userEvent.type(screen.getByLabelText("Department"), "MECH");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Zed");
  });

  it("is prefilled in edit mode and has a working Cancel", async () => {
    const onCancel = vi.fn();
    render(<StudentForm student={ASHA} onSubmit={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByText("Edit student #101")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Asha");
    expect(screen.getByLabelText("Year")).toHaveValue("2");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows the message, styled as an error when needed", () => {
    render(
      <StudentForm
        message={{ text: "name must be text", isError: true }}
        onSubmit={vi.fn()}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("name must be text");
    expect(screen.getByRole("status")).toHaveClass("error");
  });
});

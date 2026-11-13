import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import ChatWidget from "../src/components/ChatWidget.jsx";

vi.mock("../src/api.js");

beforeEach(() => {
  vi.resetAllMocks();
  api.getChatHistory.mockResolvedValue({ messages: [] });
});

const open = () => userEvent.click(screen.getByRole("button", { name: "Open chat" }));

it("shows only the bubble until it is clicked, and closes again", async () => {
  render(<ChatWidget role="teacher" />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await open();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Close chat", expanded: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("loads the saved history when opened", async () => {
  api.getChatHistory.mockResolvedValue({
    messages: [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ],
  });
  render(<ChatWidget role="principal" />);
  await open();
  expect(await screen.findByText("Hello!")).toBeInTheDocument();
  expect(screen.getByText("Hi")).toBeInTheDocument();
});

it("streams the reply piece by piece into one bubble", async () => {
  api.streamChat.mockImplementation(async (_msg, onChunk) => {
    onChunk("Asha ");
    onChunk("is great.");
  });
  render(<ChatWidget role="teacher" />);
  await open();
  await userEvent.type(screen.getByLabelText("Message"), "How is Asha?");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("Asha is great.")).toBeInTheDocument();
  expect(screen.getByText("How is Asha?")).toBeInTheDocument();
  expect(api.streamChat).toHaveBeenCalledWith("How is Asha?", expect.any(Function), expect.any(AbortSignal));
});

it("shows suggestions per role and sends one when clicked", async () => {
  api.streamChat.mockResolvedValue();
  render(<ChatWidget role="principal" />);
  await open();
  await userEvent.click(await screen.findByRole("button", { name: "Show confidential reviews for Ravi" }));
  expect(api.streamChat.mock.calls[0][0]).toBe("Show confidential reviews for Ravi");
});

it("teachers are not offered the confidential suggestion", async () => {
  render(<ChatWidget role="teacher" />);
  await open();
  await screen.findByText("Ask me about student reviews.");
  expect(screen.queryByText(/confidential/i)).not.toBeInTheDocument();
});

it("shows a server error such as the daily limit", async () => {
  api.streamChat.mockRejectedValue(new Error("Daily chat limit reached."));
  render(<ChatWidget role="teacher" />);
  await open();
  await userEvent.type(screen.getByLabelText("Message"), "hello");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Daily chat limit reached.");
});

it("renders model output as plain text, not HTML", async () => {
  api.streamChat.mockImplementation(async (_m, onChunk) => onChunk("<b>bold</b>"));
  render(<ChatWidget role="teacher" />);
  await open();
  await userEvent.type(screen.getByLabelText("Message"), "x");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("<b>bold</b>")).toBeInTheDocument();
  expect(document.querySelector("b")).toBeNull();
});

it("Clear empties the conversation", async () => {
  api.getChatHistory.mockResolvedValue({ messages: [{ role: "user", content: "Hi" }] });
  api.clearChatHistory.mockResolvedValue(null);
  render(<ChatWidget role="teacher" />);
  await open();
  await screen.findByText("Hi");
  await userEvent.click(screen.getByRole("button", { name: "Clear chat" }));
  await waitFor(() => expect(screen.queryByText("Hi")).not.toBeInTheDocument());
  expect(api.clearChatHistory).toHaveBeenCalled();
});

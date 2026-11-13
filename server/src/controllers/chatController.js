import { Conversation } from "../models/Conversation.js";
import { llm, trimHistory, toFriendlyError } from "../services/llm.js";
import { loadChatSetup } from "../services/chatContext.js";
import { CHAT_MAX_CHARS, CHAT_HISTORY_TOKENS } from "../config/index.js";

export async function getHistory(req, res) {
  const convo = await Conversation.findOne({ user: req.user.id });
  res.json({ messages: convo ? convo.messages.slice(-50) : [] });
}

export async function clearHistory(req, res) {
  await Conversation.updateOne({ user: req.user.id }, { $set: { messages: [] } });
  res.status(204).end();
}

export async function sendMessage(req, res) {
  const text = String(req.body?.message ?? "").trim();
  if (!text) return res.status(400).json({ error: "Message is required" });
  if (text.length > CHAT_MAX_CHARS) {
    return res.status(400).json({ error: "Message is too long" });
  }

  const convo = await Conversation.reserveMessage(req.user.id);
  if (!convo) {
    return res.status(429).json({ error: "Daily chat limit reached." });
  }

  // the role comes from the login session, never from the request body
  const history = trimHistory(convo.messages, { maxTokens: CHAT_HISTORY_TOKENS });
  const setup = await loadChatSetup(req.user.role);
  const messages = [
    { role: "system", content: setup.content },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: text },
  ];

  // stop paying for tokens if the user closes the chat mid-reply
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  let reply = "";
  try {
    const stream = await llm.startChatStream(messages, controller.signal, setup.options);
    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");

    for await (const chunk of stream) {
      const piece = chunk.choices[0]?.delta?.content;
      if (piece) {
        reply += piece;
        res.write(piece);
      }
    }
    res.end();
  } catch (err) {
    if (controller.signal.aborted) {
      console.log("Client left; stream stopped");
    } else if (!res.headersSent) {
      const { status, message } = toFriendlyError(err);
      return res.status(status).json({ error: message });
    } else {
      console.error(err);
      res.end("\n\n[Sorry, the reply was cut off. Please try again.]");
    }
  }

  // save after the stream: the user's message + whatever reply we got
  const newMessages = [{ role: "user", content: text }];
  if (reply) newMessages.push({ role: "assistant", content: reply });
  await Conversation.updateOne(
    { user: req.user.id },
    { $push: { messages: { $each: newMessages, $slice: -200 } } }
  );
}

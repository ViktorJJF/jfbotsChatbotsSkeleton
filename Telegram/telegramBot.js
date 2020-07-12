process.env.NTBA_FIX_319 = 1;
const config = require("../config");
const TelegramBot = require("node-telegram-bot-api");
const dialogflow = require("../dialogflow");
const { structProtoToJson } = require("../helpers/structFunctions");
//delete this
const users = []; //convert to database
// replace the value below with the Telegram token you receive from @BotFather
const token = config.TELEGRAMTOKEN;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {
  polling: true,
});

bot.on("callback_query", async (action) => {
  let msg = action.data;
  let senderID = action.from.id;
  await sendTextMessage(senderID, "<b>Seleccionaste:</b> " + msg);
  await sendToDialogFlow(senderID, msg);
  // bot.answerCallbackQuery({
  //     callback_query_id: action.id,
  //     text: "El texto alerta",
  //     show_alert: false
  // })
});

// Listen for any kind of message. There are different kinds of
// messages.
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const sender = msg.from.id;
  const message = msg.text;
  //check if user was registered
  saveUserInformation(msg);
  console.log("mensaje recibido: ", msg);
  await sendToDialogFlow(sender, message);
  // send a message to the chat acknowledging receipt of their message
});

function saveUserInformation(msg) {
  let userId = msg.from.id;
  console.log("empezando a guardar");
  if (users.findIndex((user) => user.id === userId) === -1) {
    users.push({
      id: userId,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name,
    });
    console.log("se guardo...", users);
  }
}

function getUserData(userId) {
  return users.find((user) => user.id === userId);
}

async function handleDialogFlowResponse(sender, response) {
  console.log("el id de respuesta: ", sender);
  let responseText = response.fulfillmentMessages.fulfillmentText;
  let messages = response.fulfillmentMessages;
  let action = response.action;
  let contexts = response.outputContexts;
  let parameters = response.parameters;

  if (isDefined(action)) {
    console.log("se mandara a handleDialogFlowAction");
    handleDialogFlowAction(sender, action, messages, contexts, parameters);
  } else if (isDefined(messages)) {
    console.log("se entrara a handleMessages");
    handleMessages(messages, sender);
  } else if (responseText == "" && !isDefined(action)) {
    //dialogflow could not evaluate input.
    sendTextMessage(
      sender,
      "I'm not sure what you want. Can you be more specific? gaa"
    );
  } else if (isDefined(responseText)) {
    console.log("se mandara a sendTextMessage");
    sendTextMessage(sender, responseText);
  }
}

async function handleDialogFlowAction(
  sender,
  action,
  messages,
  contexts,
  parameters
) {
  switch (action) {
    case "ActionQueja.action":
      handleMessages(messages, sender);
      break;
    default:
      console.log(
        "se mandara el mensaje por defecto de handleDialogFlowAction"
      );
      handleMessages(messages, sender);
      break;
  }
}

async function sendToDialogFlow(senderID, messageText) {
  sendTypingOn(senderID);
  let result = await dialogflow.sendToDialogFlow(
    senderID,
    messageText,
    "TELEGRAM"
  );
  handleDialogFlowResponse(senderID, result);
}

function sendTypingOn(senderID) {
  bot.sendChatAction(senderID, "typing");
}

async function handleMessage(message, sender) {
  console.log("se entro a handleMessage");
  console.log("mensaje: ", message);
  console.log("switch: ", message.message);
  console.log("texto: ", message.text);
  switch (message.message) {
    case "text": //text
      for (const text of message.text.text) {
        if (text !== "") {
          await sendTextMessage(sender, text);
        }
      }
      break;
    case "quickReplies": //quick replies
      let title = message.quickReplies.title;
      console.log("el titulo es:", title);
      let replies = [];
      message.quickReplies.quickReplies.forEach((text) => {
        replies.push({
          text: text,
          callback_data: text,
        });
      });
      sendQuickReply(sender, title, replies);
      break;
    case "image": //image
      await sendImageMessage(sender, message.image.imageUri);
      break;
    case "payload":
      handleDialogflowPayload(sender, message.payload);
      break;
  }
}

function handleDialogflowPayload(senderID, payload) {
  let desestructPayload = structProtoToJson(payload);
  let type = desestructPayload.telegram.attachment.payload.template_type;
  console.log("el mensaje desestructurado: ", desestructPayload);
  switch (type) {
    case "button":
      let text = desestructPayload.telegram.attachment.payload.text;
      let buttons = desestructPayload.telegram.attachment.payload.buttons;
      let formattedButtons = [];
      buttons.forEach((button) => {
        formattedButtons.push({
          text: button.title,
          url: button.url,
        });
      });
      sendButtons(senderID, text, formattedButtons);
      break;

    default:
      console.log("el tipo de payload no se reconoce...");
      break;
  }
}

async function sendButtons(senderID, title, buttons) {
  await bot.sendMessage(senderID, title, {
    reply_markup: {
      inline_keyboard: [buttons],
      resize_keyboard: true,
    },
    parse_mode: "HTML",
  });
}

async function sendQuickReply(senderID, title, replies) {
  await bot.sendMessage(senderID, title, {
    parse_mode: "html",
    reply_markup: {
      inline_keyboard: [replies],
      resize_keyboard: true,
    },
  });
}

async function sendImageMessage(senderID, url) {
  await bot.sendChatAction(senderID, "upload_photo");
  await bot.sendPhoto(senderID, url);
}

function handleMessages(messages, sender) {
  let timeoutInterval = 1100;
  let previousType;
  let cardTypes = [];
  let timeout = 0;
  for (var i = 0; i < messages.length; i++) {
    if (
      previousType == "card" &&
      (messages[i].message != "card" || i == messages.length - 1)
    ) {
      timeout = (i - 1) * timeoutInterval;
      setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
      cardTypes = [];
      timeout = i * timeoutInterval;
      setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
    } else if (messages[i].message == "card" && i == messages.length - 1) {
      cardTypes.push(messages[i]);
      timeout = (i - 1) * timeoutInterval;
      setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
      cardTypes = [];
    } else if (messages[i].message == "card") {
      cardTypes.push(messages[i]);
    } else {
      timeout = i * timeoutInterval;
      setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
    }
    previousType = messages[i].message;
  }
}

async function handleCardMessages(messages, senderID) {
  console.log(
    "se recibio esto en handleCardMessages: ",
    JSON.stringify(messages, null, " ")
  );
  for (let m = 0; m < messages.length; m++) {
    let message = messages[m];
    let buttons = [];
    for (var b = 0; b < message.card.buttons.length; b++) {
      let isLink = message.card.buttons[b].postback.substring(0, 4) === "http";
      let button;
      if (isLink) {
        button = {
          text: message.card.buttons[b].text,
          url: message.card.buttons[b].postback,
        };
      } else {
        button = {
          text: message.card.buttons[b].text,
          callback_data: message.card.buttons[b].postback,
        };
      }
      buttons.push(button);
    }

    let element = {
      title: message.card.title,
      image_url: message.card.imageUri,
      subtitle: message.card.subtitle || " ",
      buttons: buttons,
    };
    console.log("el elemento queda asi: ", element);
    await sendGenericMessage(senderID, element);
  }
}

async function sendGenericMessage(senderID, element) {
  await sendImageMessage(senderID, element.image_url);
  // await sendTextMessage(senderID, `<b>${element.title}</b>`);
  await sendButtons(
    senderID,
    "<b>" + element.title + "</b>" + "\n" + element.subtitle,
    element.buttons
  );
}

let sendTextMessage = (senderID, message) => {
  if (message.includes("{first_name}") || message.includes("{{last_name}}")) {
    let userData = getUserData(senderID);
    message = message
      .replace("{first_name}", userData.first_name)
      .replace("{{last_name}}", userData.last_name);
  }
  bot.sendMessage(senderID, message, {
    parse_mode: "HTML",
  });
};

function isDefined(obj) {
  if (obj === undefined) {
    return false;
  }

  if (obj === null) {
    return false;
  }
  return true;
}

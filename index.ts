import "dotenv/config";
import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api";
import express, { query } from "express";
import cors from "cors";
import { Wallet } from "ethers";
import { Calendar } from "@michpl/telegram-calendar";

import {
  AskEstablish,
  BuyCard,
  BuyInfo,
  FundInfoSetting,
  MainCard,
  MainLineKey,
  UpdateWallet,
} from "./Inline";
import {
  CuponControlInfo,
  CuponIds,
  EstablishInfo,
  FundInfo,
  StateInfo,
  WalletInfo,
} from "./utils";
import { ValidateWalletPublicKey } from "./validate";

const calendar = new Calendar();

const app = express();
const port = process.env.PORT || 3020;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(port, () => {
  console.log(`Express started on http://localhost:${port}`);
});

const botToken = process.env.TG_TOKEN;
const buyChannel = process.env.BUY_CHANNEL;
const mainChannel = process.env.FUND_CHANNEL;

const ControlInfo: { [key: number]: CuponControlInfo } = {};
const MessageStateInfo: { [key: number]: StateInfo } = {};
const UserWalletInfo: { [key: number]: WalletInfo } = {};
const UserEstablishInfo: { [key: number]: EstablishInfo } = {};
const UserFundInfo: { [key: number]: FundInfo } = {};
const UserCuponIds: { [key: number]: CuponIds } = {};

const bot = new TelegramBot(botToken!, {
  polling: true,
});

app.post("/fund", (req, res) => {
  try {
    bot.sendMessage(
      buyChannel!,
      `${BuyCard(
        453463,
        "TESTCUPON",
        "10",
        "0x6322345362345",
        "0.02",
        new Date("2023-10-21")
      )}`,
      {
        parse_mode: "Markdown",
      }
    );
  } catch (error) {}
});

app.post("/post", (req, res) => {
  try {
    bot.sendMessage(mainChannel!, `${MainCard()}`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: MainLineKey() },
    });
  } catch (error) {}
});

bot.onText(/\/start/, async (msg: Message) => {
  try {
    const chatId = msg.chat.id;

    const botType = msg.text?.split(" ")[1].split("_")[0];

    if (botType === "buy") {
      const [type, cupon_id] = msg.text!.split(" ")[1].split("_");

      ControlInfo[chatId] = {
        type: type,
        cupon_id: cupon_id,
      };
    } else if (botType === "mint") {
      ControlInfo[chatId] = { type: "mint" };
    } else if (botType === "establish") {
      ControlInfo[chatId] = { type: "establish" };
    } else if (botType === "fund") {
      ControlInfo[chatId] = { type: "fund" };
    }

    const sentMsg = await bot.sendMessage(
      msg.chat.id,
      "Welcome! Click the buttons below for actions.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Wallet", callback_data: "setup_wallet" }],
          ],
        },
      }
    );

    MessageStateInfo[chatId] = {
      state: "",
      deleteMessageNumber: sentMsg.message_id,
    };
  } catch (error) {}
});

bot.on("message", async (msg: Message) => {
  const chatId = msg.chat.id;
  let sentMsg;

  if (msg.text?.includes("/start")) {
    removeMessage(chatId, msg.message_id);
  }

  switch (MessageStateInfo[chatId]?.state) {
    case "awaiting_wallet_address":
      try {
        removeMessage(chatId, msg.message_id);
        const wallet = new Wallet(msg.text!);
        UserWalletInfo[chatId] = {
          wallet_address: msg.text!,
          wallet_public: wallet.address,
          wallet: wallet,
        };

        console.log("This is wallet address", msg.text!);

        SelectWay(chatId);
      } catch (error) {
        console.log("Wallet Privatekey Error", error);

        sentMsg = await bot.sendMessage(
          chatId,
          "Your private key is incorrect. Please input correct key."
        );

        MessageStateInfo[chatId!] = {
          state: "awaiting_wallet_address",
          deleteMessageNumber: sentMsg.message_id,
        };
      }
      break;

    case "awaiting_eth_amount":
      ControlInfo[chatId].eth = msg.text!;

      sentMsg = await bot.sendMessage(
        chatId,
        `${BuyInfo(
          ControlInfo[chatId].cupon_id!,
          ControlInfo[chatId].eth!,
          "1234"
        )}`
      );

      MessageStateInfo[chatId!] = {
        state: "",
        deleteMessageNumber: sentMsg.message_id,
      };
      break;

    case "awaiting_establish_cupon_id":
      // Input establish cupon id

      if (UserCuponIds[chatId].ids.includes(msg.text!)) {
        UserEstablishInfo[chatId] = { id: parseInt(msg.text!) };

        sentMsg = await bot.sendMessage(chatId, "Please input address.");

        MessageStateInfo[chatId!] = {
          state: "awaiting_establish_address",
          deleteMessageNumber: sentMsg.message_id,
        };
      } else {
        sentMsg = await bot.sendMessage(
          await chatId,
          "Plase input your correct cupon id."
        );

        MessageStateInfo[chatId] = {
          state: "awaiting_establish_cupon_id",
          deleteMessageNumber: sentMsg.message_id,
        };
      }
      break;

    case "awaiting_establish_address":
      const check = ValidateWalletPublicKey(msg.text!);
      if (check) {
        UserEstablishInfo[chatId].address = msg.text!;
        // Establish this cupon using UserEstablishInfo[chatId]

        if (true) {
          sentMsg = await bot.sendMessage(chatId, "Congratulation!");

          MessageStateInfo[chatId!] = {
            state: "",
            deleteMessageNumber: sentMsg.message_id,
          };
        }
      } else {
        sentMsg = await bot.sendMessage(chatId, "Please input correct key.");

        MessageStateInfo[chatId!] = {
          state: "awaiting_establish_address",
          deleteMessageNumber: sentMsg.message_id,
        };
      }

      break;

    case "awaiting_fund_cupon_id":
      if (UserCuponIds[chatId].ids.includes(msg.text!)) {
        UserFundInfo[chatId] = { id: parseInt(msg.text!) };
        BackFundControl(chatId);
      } else {
        sentMsg = await bot.sendMessage(
          chatId,
          "Plase input your correct cupon id."
        );

        MessageStateInfo[chatId] = {
          state: "awaiting_fund_cupon_id",
          deleteMessageNumber: sentMsg.message_id,
        };
      }
      break;

    case "awaiting_cupon_name":
      UserFundInfo[chatId].cupon_name = msg.text!;
      BackFundControl(chatId);
      break;

    case "awaiting_bonus_percentage":
      UserFundInfo[chatId].bonus = msg.text!;
      BackFundControl(chatId);
      break;

    case "awaiting_contract_address":
      UserFundInfo[chatId].address = msg.text!;
      BackFundControl(chatId);
      break;

    case "awaiting_starting_reward":
      UserFundInfo[chatId].reward = msg.text!;
      BackFundControl(chatId);
      break;
    default:
      return;
  }
});

bot.on("callback_query", async (query: CallbackQuery) => {
  const chatId = query.message?.chat.id;
  const [action] = query.data!.split(" ");
  let sentMsg;

  switch (action) {
    case "setup_wallet":
      // Set private key of user wallet
      // removeMessage(chatId!, query.message?.message_id!);
      if (UserWalletInfo[chatId!]?.wallet_address) {
        sentMsg = await bot.sendMessage(
          chatId!,
          "You already set wallet private key.\nCould you set new wallet?\n\n",
          {
            reply_markup: {
              inline_keyboard: UpdateWallet(),
            },
          }
        );
        return;
      }

      sentMsg = await bot.sendMessage(
        chatId!,
        "Please enter your private wallet key."
      );

      MessageStateInfo[chatId!] = {
        state: "awaiting_wallet_address",
        deleteMessageNumber: sentMsg.message_id,
      };
      break;

    case "mint_cupon":
      // Mint cupon using cupon ID
      // After check the cupon was minted.
      if (true) {
        sentMsg = await bot.sendMessage(
          chatId!,
          "Would you like establish this token?",
          { reply_markup: { inline_keyboard: AskEstablish() } }
        );

        MessageStateInfo[chatId!] = {
          state: "",
          deleteMessageNumber: sentMsg.message_id,
        };
      }
      break;

    case "establish_fund":
      //Establis fund
      // Get this cupon Id & set
      UserEstablishInfo[chatId!] = { id: 234 };

      sentMsg = await bot.sendMessage(chatId!, "Please input address.");

      MessageStateInfo[chatId!] = {
        state: "awaiting_establish_address",
        deleteMessageNumber: sentMsg.message_id,
      };
      break;

    case "no_establish":
      sentMsg = await bot.sendMessage(chatId!, "Congratulation mint token.");

      MessageStateInfo[chatId!] = {
        state: "",
        deleteMessageNumber: sentMsg.message_id,
      };
      break;

    case "cupon_name":
      removeMessage(chatId!, query.message?.message_id!);
      sentMsg = await bot.sendMessage(chatId!, "Please input cupon name");

      MessageStateInfo[chatId!] = {
        state: "awaiting_cupon_name",
        deleteMessageNumber: sentMsg.message_id,
      };
      break;

    case "bonus_amount":
      removeMessage(chatId!, query.message?.message_id!);
      sentMsg = await bot.sendMessage(chatId!, "Please input bonus percentage");

      MessageStateInfo[chatId!] = {
        state: "awaiting_bonus_percentage",
        deleteMessageNumber: sentMsg.message_id,
      };
      break;

    case "contract_address":
      removeMessage(chatId!, query.message?.message_id!);
      sentMsg = await bot.sendMessage(chatId!, "Please input contract address");

      MessageStateInfo[chatId!] = {
        state: "awaiting_contract_address",
        deleteMessageNumber: sentMsg.message_id,
      };
      break;

    case "starting_reward":
      removeMessage(chatId!, query.message?.message_id!);
      sentMsg = await bot.sendMessage(chatId!, "Please input starting reward");

      MessageStateInfo[chatId!] = {
        state: "awaiting_starting_reward",
        deleteMessageNumber: sentMsg.message_id,
      };
      break;

    case "vesting_time":
      removeMessage(chatId!, query.message?.message_id!);
      UserFundInfo[chatId!].vest = new Date();

      sentMsg = await bot.sendMessage(chatId!, "Please enter date.", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: calendar.getPage(new Date()),
        },
      });
      break;

    case "eth_reward":
      removeMessage(chatId!, query.message?.message_id!);
      if (!UserFundInfo[chatId!].token_type) {
        UserFundInfo[chatId!].token_type = true;
      } else {
        UserFundInfo[chatId!].token_type = false;
      }
      BackFundControl(chatId!);
      break;

    case "fund":
      try {
        bot.sendMessage(
          buyChannel!,
          `${BuyCard(
            UserFundInfo[chatId!].id,
            UserFundInfo[chatId!].cupon_name!,
            UserFundInfo[chatId!].bonus!,
            UserFundInfo[chatId!].address!,
            UserFundInfo[chatId!].reward!,
            UserFundInfo[chatId!].vest!
          )}`,
          {
            parse_mode: "Markdown",
          }
        );
      } catch (error) {}
      break;

    case "no_update":
      removeMessage(chatId!, query.message?.message_id!);

      SelectWay(chatId!);
      break;

    case "wallet_update":
      removeMessage(chatId!, query.message?.message_id!);

      sentMsg = await bot.sendMessage(chatId!, "Plase input your update key.");

      MessageStateInfo[chatId!] = {
        state: "awaiting_wallet_address",
        deleteMessageNumber: sentMsg.message_id,
      };
      break;

    default:
      try {
        const { date, action } = JSON.parse(query.data!);

        if ((date === 0 && action === null) || action === "select-year") return;

        const currentDate = new Date(UserFundInfo[chatId!].vest!);

        if (action === "next-month") {
          currentDate.setMonth(currentDate.getMonth() + 1);

          sentMsg = await bot.sendMessage(chatId!, "Please enter date.", {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: calendar.getPage(currentDate),
            },
          });

          MessageStateInfo[chatId!] = {
            state: "",
            deleteMessageNumber: sentMsg.message_id,
          };
        } else if (action === "prev-month") {
          currentDate.setMonth(currentDate.getMonth() - 1);
          sentMsg = await bot.sendMessage(chatId!, "Please enter date.", {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: calendar.getPage(currentDate),
            },
          });

          MessageStateInfo[chatId!] = {
            state: "",
            deleteMessageNumber: sentMsg.message_id,
          };
        } else {
          UserFundInfo[chatId!].vest = date;
          BackFundControl(chatId!);
        }
      } catch (error) {}

      break;
  }
});

const BackFundControl = async (chatId: number) => {
  const sentMsg = await bot.sendMessage(
    chatId,
    `Please input fund token info.\n\nCupon ID: #${
      UserFundInfo[chatId].id ? UserFundInfo[chatId].id : ""
    }\nCupon Name: ${
      UserFundInfo[chatId].cupon_name ? UserFundInfo[chatId].cupon_name : ""
    }\nBonus Percentage: ${
      UserFundInfo[chatId].bonus ? UserFundInfo[chatId].bonus : ""
    }\nContract Address: ${
      UserFundInfo[chatId].address ? UserFundInfo[chatId].address : ""
    }\nStarting Reward: ${
      UserFundInfo[chatId].reward ? UserFundInfo[chatId].reward : ""
    }\nVesting Time: ${
      UserFundInfo[chatId].vest ? UserFundInfo[chatId].vest : ""
    }\nETH reward: ${UserFundInfo[chatId].token_type ? "ETH" : "TOKEN"}`,
    {
      reply_markup: { inline_keyboard: FundInfoSetting() },
    }
  );

  MessageStateInfo[chatId!] = {
    state: "",
    deleteMessageNumber: sentMsg.message_id,
  };
};

const SelectWay = async (chatId: number) => {
  let sentMsg;

  if (ControlInfo[chatId].type === "buy") {
    sentMsg = await bot.sendMessage(chatId, "Please input amount of ETH");

    MessageStateInfo[chatId!] = {
      state: "awaiting_eth_amount",
      deleteMessageNumber: sentMsg.message_id,
    };
  } else if (ControlInfo[chatId].type === "mint") {
    sentMsg = await bot.sendMessage(chatId, `Info of Mint\n\n`, {
      reply_markup: {
        inline_keyboard: [[{ text: "Mint", callback_data: "mint_cupon" }]],
      },
    });

    MessageStateInfo[chatId!] = {
      state: "",
      deleteMessageNumber: sentMsg.message_id,
    };
  } else if (ControlInfo[chatId].type === "establish") {
    // Find cupons using his wallet private key
    UserCuponIds[chatId] = { ids: ["123", "523", "1235", "5234"] };
    const cuponText = UserCuponIds[chatId].ids.join(", ");

    sentMsg = await bot.sendMessage(
      chatId!,
      `Here is your cupons.\n\n${cuponText}\n\nPlease input Cupon Id`
    );

    MessageStateInfo[chatId!] = {
      state: "awaiting_establish_cupon_id",
      deleteMessageNumber: sentMsg.message_id,
    };
  } else if (ControlInfo[chatId].type === "fund") {
    // Find fund token using UserWalletInfo[ahtId].wallet_public
    UserCuponIds[chatId] = { ids: ["12343", "23", "125", "523424"] };
    const cuponText = UserCuponIds[chatId].ids.join(", ");

    sentMsg = await bot.sendMessage(
      chatId!,
      `Here is your cupons.\n\n${cuponText}\n\nPlease input Cupon Id`
    );

    MessageStateInfo[chatId!] = {
      state: "awaiting_fund_cupon_id",
      deleteMessageNumber: sentMsg.message_id,
    };
  }
};

const removeMessage = (chatId: number, msgId: number) => {
  bot.deleteMessage(chatId, msgId);
};

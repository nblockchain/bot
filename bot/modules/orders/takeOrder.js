// @ts-check
const { logger } = require('../../../logger');
const { Order } = require('../../../models');
const { deleteOrderFromChannel } = require('../../../util');
const messages = require('../../messages');
const {
  validateUserWaitingOrder,
  isBannedFromCommunity,
  validateTakeSellOrder,
  validateSeller,
  validateObjectId,
  validateTakeBuyOrder,
} = require('../../validations');

exports.takeOrderActionValidation = async (ctx, next) => {
  try {
    const text = ctx.update.callback_query.message.text;
    if (!text) return;
    next();
  } catch (err) {
    logger.error(err);
  }
};
exports.takeOrderValidation = async (ctx, next) => {
  try {
    const { user } = ctx;
    if (!(await validateUserWaitingOrder(ctx, ctx, user))) return;
    next();
  } catch (err) {
    logger.error(err);
  }
};
exports.takebuyValidation = async (ctx, next) => {
  try {
    // Sellers with orders in status = FIAT_SENT, have to solve the order
    const isOnFiatSentStatus = await validateSeller(ctx, ctx.user);
    if (!isOnFiatSentStatus) return;
    next();
  } catch (err) {
    logger.error(err);
  }
};
exports.takebuy = async (ctx, bot, orderId) => {
  try {
    if (!orderId) return;
    const { user } = ctx;
    if (!(await validateObjectId(ctx, orderId))) return;
    const order = await Order.findOne({ _id: orderId });
    if (!order) return;
    // We verify if the user is not banned on this community
    if (await isBannedFromCommunity(user, order.community_id))
      return await messages.bannedUserErrorMessage(ctx, user);

    if (!(await validateTakeBuyOrder(ctx, bot, user, order))) return;
    // We change the status to trigger the expiration of this order
    // if the user don't do anything
    order.status = 'WAITING_PAYMENT';
    order.seller_id = user._id;
    order.taken_at = Date.now();
    await order.save();
    // We delete the messages related to that order from the channel
    await deleteOrderFromChannel(order, bot.telegram);
    await messages.beginTakeBuyMessage(ctx, bot, user, order);
  } catch (error) {
    logger.error(error);
  }
};
exports.takesell = async (ctx, bot, orderId) => {
  try {
    const { user } = ctx;
    if (!orderId) return;
    const order = await Order.findOne({ _id: orderId });
    if (!order) return;
    // We verify if the user is not banned on this community
    if (await isBannedFromCommunity(user, order.community_id))
      return await messages.bannedUserErrorMessage(ctx, user);
    if (!(await validateTakeSellOrder(ctx, bot, user, order))) return;
    order.status = 'WAITING_BUYER_INVOICE';
    order.buyer_id = user._id;
    order.taken_at = Date.now();

    await order.save();
    // We delete the messages related to that order from the channel
    await deleteOrderFromChannel(order, bot.telegram);
    await messages.beginTakeSellMessage(ctx, bot, user, order);
  } catch (error) {
    logger.error(error);
  }
};

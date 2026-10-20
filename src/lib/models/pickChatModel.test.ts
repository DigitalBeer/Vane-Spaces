// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pickChatModel } from './pickChatModel';

const laptop = { providerId: 'laptop', key: 'gemma' };
const cloud = { providerId: 'or', key: 'model:free' };

describe('pickChatModel', () => {
  it('uses the Discover model for Discover chats', () => {
    expect(
      pickChatModel({ origin: 'discover', chatModel: laptop, discoverModel: cloud, fallbackModel: laptop }),
    ).toEqual({ chatModel: cloud, fallbackChatModel: laptop });
  });

  it('uses the chat model for other chats, and drops a fallback equal to it', () => {
    expect(
      pickChatModel({ origin: 'user', chatModel: laptop, discoverModel: cloud, fallbackModel: laptop }),
    ).toEqual({ chatModel: laptop, fallbackChatModel: null });
  });

  it('uses the chat model for Discover chats when no Discover model is set', () => {
    expect(
      pickChatModel({ origin: 'discover', chatModel: laptop, discoverModel: null, fallbackModel: null }),
    ).toEqual({ chatModel: laptop, fallbackChatModel: null });
  });
});

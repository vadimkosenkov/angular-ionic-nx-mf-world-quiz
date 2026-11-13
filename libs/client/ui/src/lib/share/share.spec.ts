import { describe, expect, it } from 'vitest';
import { browserShareTarget, shareLines } from './share';

const payload = {
  title: 'World Quiz',
  text: 'Capitals, Europe\n20/20',
  url: 'https://example.test',
};

describe('shareLines', () => {
  it('joins the lines a message has and drops the ones it has not', () => {
    expect(shareLines('first', null, '  ', 'second', undefined)).toBe(
      'first\nsecond',
    );
  });
});

describe('browserShareTarget', () => {
  it('opens the system sheet with the text and the address', async () => {
    const shared: ShareData[] = [];
    const target = browserShareTarget({
      share: (data) => {
        shared.push(data);
        return Promise.resolve();
      },
    });

    await expect(target.share(payload)).resolves.toBe('shared');
    expect(shared).toEqual([
      { title: 'World Quiz', text: payload.text, url: payload.url },
    ]);
  });

  it('leaves the address out when the app does not know its own', async () => {
    const shared: ShareData[] = [];
    const target = browserShareTarget({
      share: (data) => {
        shared.push(data);
        return Promise.resolve();
      },
    });

    await target.share({ title: 'World Quiz', text: 'Capitals' });

    expect(shared[0]).not.toHaveProperty('url');
  });

  // The player closed the sheet. Nothing went wrong, so nothing is reported.
  it('says cancelled when the player closes the sheet', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const target = browserShareTarget({ share: () => Promise.reject(abort) });

    await expect(target.share(payload)).resolves.toBe('cancelled');
  });

  it('copies the message when there is no sheet', async () => {
    const copied: string[] = [];
    const target = browserShareTarget({
      clipboard: {
        writeText: (text) => {
          copied.push(text);
          return Promise.resolve();
        },
      },
    });

    await expect(target.share(payload)).resolves.toBe('copied');
    // One string this time, so the address has to be inside the text.
    expect(copied).toEqual([`${payload.text}\n${payload.url}`]);
  });

  it('copies the message when the sheet refuses for another reason', async () => {
    const copied: string[] = [];
    const target = browserShareTarget({
      share: () => Promise.reject(new Error('not allowed')),
      clipboard: {
        writeText: (text) => {
          copied.push(text);
          return Promise.resolve();
        },
      },
    });

    await expect(target.share(payload)).resolves.toBe('copied');
    expect(copied).toHaveLength(1);
  });

  it('fails when the browser can neither share nor copy', async () => {
    await expect(browserShareTarget({}).share(payload)).resolves.toBe('failed');
  });

  it('fails when the clipboard refuses', async () => {
    const target = browserShareTarget({
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    });

    await expect(target.share(payload)).resolves.toBe('failed');
  });
});

describe('sharing a picture', () => {
  const picture = () =>
    Promise.resolve(new File(['png'], 'world-quiz.png', { type: 'image/png' }));

  it('sends the picture where the device takes files', async () => {
    const shared: ShareData[] = [];
    const target = browserShareTarget({
      canShare: () => true,
      share: (data) => {
        shared.push(data);
        return Promise.resolve();
      },
    });

    await expect(target.share({ ...payload, image: picture })).resolves.toBe(
      'shared',
    );
    expect(shared[0]?.files?.[0]?.type).toBe('image/png');
    // A sheet carrying a file may drop a separate address, so it travels
    // inside the text.
    expect(shared[0]?.text).toBe(`${payload.text}\n${payload.url}`);
    expect(shared[0]).not.toHaveProperty('url');
  });

  it('sends the text where files are refused, and paints nothing', async () => {
    const shared: ShareData[] = [];
    let painted = 0;
    const target = browserShareTarget({
      canShare: () => false,
      share: (data) => {
        shared.push(data);
        return Promise.resolve();
      },
    });

    await target.share({
      ...payload,
      image: () => {
        painted += 1;
        return picture();
      },
    });

    expect(painted).toBe(0);
    expect(shared[0]).toEqual({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    });
  });

  it('sends the text when the picture cannot be drawn', async () => {
    const shared: ShareData[] = [];
    const target = browserShareTarget({
      canShare: () => true,
      share: (data) => {
        shared.push(data);
        return Promise.resolve();
      },
    });

    await expect(
      target.share({ ...payload, image: () => Promise.resolve(null) }),
    ).resolves.toBe('shared');
    expect(shared[0]?.files).toBeUndefined();
  });

  // Some engines throw from `canShare` rather than answering it.
  it('sends the text when asking about files throws', async () => {
    const shared: ShareData[] = [];
    const target = browserShareTarget({
      canShare: () => {
        throw new TypeError('illegal invocation');
      },
      share: (data) => {
        shared.push(data);
        return Promise.resolve();
      },
    });

    await expect(target.share({ ...payload, image: picture })).resolves.toBe(
      'shared',
    );
    expect(shared[0]?.files).toBeUndefined();
  });

  it('says cancelled when the player closes a sheet holding the picture', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const target = browserShareTarget({
      canShare: () => true,
      share: () => Promise.reject(abort),
    });

    await expect(target.share({ ...payload, image: picture })).resolves.toBe(
      'cancelled',
    );
  });
});

import ShareClient from './api/share.js';

gopeed.events.onResolve(async (ctx) => {
  const url = ctx.req.url;
  gopeed.logger.info('解析百度网盘分享链接:', url);

  if (!url.includes('pan.baidu.com/s/')) {
    return;
  }

  if (!gopeed.settings.bdcookie) {
    throw new Error('请先在扩展设置中配置百度网盘 Cookie (BDUSS)');
  }

  const u = new URL(url);
  const surl = u.pathname.split('/')[2];
  const search = u.searchParams;
  let pwd = '';
  if (search && search.get('pwd')) {
    pwd = search.get('pwd');
  }

  if (!surl) {
    return;
  }

  const shareClient = new ShareClient(surl, pwd, gopeed.settings.bdcookie);
  const shareInfo = await shareClient.getShareInfo();
  const name =
    shareInfo.title.split('/').pop() +
    (shareInfo.list.length > 1 ? '等' : '');
  const parentDir =
    shareInfo.title.split('/').slice(0, -1).join('/') + '/';

  const fileList = await shareClient.getFileList();
  gopeed.logger.debug('fileList', JSON.stringify(fileList));

  ctx.res = {
    name,
    files: fileList.map((item) => ({
      name: item.server_filename,
      size: item.size,
      path: item.path
        .replace(parentDir, '')
        .split('/')
        .slice(0, -1)
        .join('/'),
      req: {
        url: `http://d.pcs.baidu.com/file/${item.fs_id}`,
        extra: {
          header: {
            'User-Agent': 'pan.baidu.com',
          },
        },
        labels: {
          [gopeed.info.identity]: '1',
          rawUrl: ctx.req.url,
          surl: surl,
          pwd: pwd,
          fid: item.fs_id,
        },
      },
    })),
  };
});

gopeed.events.onStart(async (ctx) => {
  await updateDlink(ctx.task);
});

gopeed.events.onError(async (ctx) => {
  await updateDlink(ctx.task);
  ctx.task.continue();
});

async function updateDlink(task) {
  const req = task.meta.req;
  if (!req.labels.gotDlink || task.status == 'error') {
    const fid = req.labels.fid;
    const surl = req.labels.surl;
    const pwd = req.labels.pwd;

    if (!surl || !fid) {
      return;
    }

    const shareClient = new ShareClient(surl, pwd, gopeed.settings.bdcookie);
    const dlink = await shareClient.getDlink(fid);
    gopeed.logger.info('获取到真实下载链接:', dlink);

    req.url = dlink;
    req.extra = {
      header: {
        'User-Agent': 'netdisk;11.4.51.4.19',
      },
    };
    req.labels.gotDlink = '1';
  }
}
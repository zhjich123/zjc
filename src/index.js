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
  let pwd = '';
  const search = u.searchParams;
  if (search && search.get('pwd')) {
    pwd = search.get('pwd');
  }

  if (!surl) {
    throw new Error('无效的百度网盘分享链接，无法提取 surl');
  }

  try {
    const shareClient = new ShareClient(surl, pwd, gopeed.settings.bdcookie);

    const shareInfo = await shareClient.getShareInfo();
    const name =
      shareInfo.title.split('/').pop() +
      (shareInfo.list.length > 1 ? '等' : '');
    const parentDir =
      shareInfo.title.split('/').slice(0, -1).join('/') + '/';

    const fileList = await shareClient.getFileList();
    gopeed.logger.info('解析到文件数量:', fileList.length);

    const fids = fileList.map((f) => f.fs_id);
    const dlinkMap = await shareClient.getBatchDlinks(fids);
    gopeed.logger.info('批量获取到 dlink 数量:', Object.keys(dlinkMap).length);

    const files = [];
    for (const item of fileList) {
      const fid = item.fs_id;
      const fileName = item.server_filename || '未知文件名';
      let downloadUrl = '';

      if (dlinkMap[fid]) {
        try {
          downloadUrl = await shareClient.resolveRealDlinkForFid(
            fid,
            dlinkMap[fid]
          );
          gopeed.logger.info('获取到真实下载链接:', fileName, downloadUrl);
        } catch (e) {
          gopeed.logger.error('获取真实下载链接失败，将使用 dlink:', fileName, e.message);
          downloadUrl = dlinkMap[fid];
        }
      }

      if (!downloadUrl) {
        gopeed.logger.error('无法获取下载链接，跳过文件:', fileName);
        continue;
      }

      files.push({
        name: fileName,
        size: item.size || 0,
        path: item.path
          ? item.path.replace(parentDir, '').split('/').slice(0, -1).join('/')
          : '',
        req: {
          url: downloadUrl,
          extra: {
            header: {
              'User-Agent': 'netdisk;11.4.51.4.19',
              Cookie: gopeed.settings.bdcookie,
            },
          },
          labels: {
            [gopeed.info.identity]: '1',
            rawUrl: ctx.req.url,
            surl: surl,
            pwd: pwd,
            fid: fid,
          },
        },
      });
    }

    ctx.res = { name, files };
  } catch (error) {
    gopeed.logger.error('解析分享链接失败:', error.message || error);
    throw error;
  }
});

gopeed.events.onStart(async (ctx) => {
  const req = ctx.task.meta.req;
  if (req.labels.gotDlink) {
    return;
  }

  const fid = req.labels.fid;
  const surl = req.labels.surl;
  const pwd = req.labels.pwd;
  if (!surl || !fid) return;

  try {
    const shareClient = new ShareClient(surl, pwd, gopeed.settings.bdcookie);
    const dlink = await shareClient.getDlink(fid);
    gopeed.logger.info('onStart 获取到真实下载链接:', dlink);

    req.url = dlink;
    req.extra = {
      header: {
        'User-Agent': 'netdisk;11.4.51.4.19',
        Cookie: gopeed.settings.bdcookie,
      },
    };
    req.labels.gotDlink = '1';
  } catch (error) {
    gopeed.logger.error('onStart 获取下载链接失败:', error.message || error);
    throw error;
  }
});

gopeed.events.onError(async (ctx) => {
  gopeed.logger.info('下载出错，尝试重新获取下载链接...');
  try {
    const req = ctx.task.meta.req;
    const fid = req.labels.fid;
    const surl = req.labels.surl;
    const pwd = req.labels.pwd;

    if (!surl || !fid) return;

    const shareClient = new ShareClient(surl, pwd, gopeed.settings.bdcookie);
    const dlink = await shareClient.getDlink(fid);
    gopeed.logger.info('onError 获取到新下载链接:', dlink);

    req.url = dlink;
    req.extra = {
      header: {
        'User-Agent': 'netdisk;11.4.51.4.19',
        Cookie: gopeed.settings.bdcookie,
      },
    };
    req.labels.gotDlink = '1';
    ctx.task.continue();
  } catch (error) {
    gopeed.logger.error('重新获取下载链接失败:', error.message || error);
  }
});
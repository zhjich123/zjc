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

  let surl = '';
  let pwd = '';

  try {
    const u = new URL(url);
    const pathParts = u.pathname.split('/');
    surl = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
    pwd = u.searchParams.get('pwd') || '';
  } catch (e) {
    throw new Error('无法解析分享链接 URL: ' + e.message);
  }

  if (!surl) {
    throw new Error('无效的百度网盘分享链接，无法提取 surl');
  }

  try {
    const shareClient = new ShareClient(surl, pwd, gopeed.settings.bdcookie);
    const shareInfo = await shareClient.getShareInfo();
    const fileList = await shareClient.getFileList();

    if (!fileList || fileList.length === 0) {
      throw new Error('分享链接中没有找到文件');
    }

    const titleParts = (shareInfo.title || '').split('/');
    const name = titleParts[titleParts.length - 1] + (fileList.length > 1 ? '等' : '');
    const parentDir = titleParts.slice(0, -1).join('/') + '/';

    ctx.res = {
      name,
      files: fileList.map((item) => ({
        name: item.server_filename || item.filename || '未知文件名',
        size: item.size || 0,
        path: item.path
          ? item.path.replace(parentDir, '').split('/').slice(0, -1).join('/')
          : '',
        req: {
          url: url,
          extra: {
            header: {
              'User-Agent': 'pan.baidu.com',
              Cookie: gopeed.settings.bdcookie,
            },
          },
          labels: {
            [gopeed.info.identity]: '1',
            surl: surl,
            pwd: pwd,
            fid: String(item.fs_id),
          },
        },
      })),
    };
  } catch (error) {
    gopeed.logger.error('解析分享链接失败:', error.message || error);
    throw error;
  }
});

gopeed.events.onStart(async (ctx) => {
  const req = ctx.task.meta.req;
  const labels = req.labels || {};
  const fid = labels.fid;
  const surl = labels.surl;
  const pwd = labels.pwd;

  if (!fid || !surl) {
    gopeed.logger.debug('onStart: 不是百度网盘任务，跳过');
    return;
  }

  try {
    const shareClient = new ShareClient(surl, pwd, gopeed.settings.bdcookie);
    const dlink = await shareClient.getDlink(fid);
    gopeed.logger.info('onStart 获取到下载链接:', dlink);

    req.url = dlink;
    req.extra = {
      header: {
        'User-Agent': 'netdisk;11.4.51.4.19',
        Cookie: gopeed.settings.bdcookie,
      },
    };
  } catch (error) {
    gopeed.logger.error('onStart 获取下载链接失败:', error.message || error);
    throw new Error('获取百度网盘下载链接失败: ' + error.message);
  }
});

gopeed.events.onError(async (ctx) => {
  gopeed.logger.info('下载出错，尝试重新获取下载链接...');
  const req = ctx.task.meta.req;
  const labels = req.labels || {};
  const fid = labels.fid;
  const surl = labels.surl;
  const pwd = labels.pwd;

  if (!fid || !surl) return;

  try {
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
    ctx.task.continue();
  } catch (error) {
    gopeed.logger.error('重新获取下载链接失败:', error.message || error);
  }
});
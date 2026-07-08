import ShareClient from './api/share.js';

gopeed.events.onResolve(async (ctx) => {
  const url = ctx.req.url;
  gopeed.logger.info('=== 扩展已触发 ===');
  gopeed.logger.info('URL:', url);

  if (!url.includes('pan.baidu.com/s/')) {
    gopeed.logger.info('不匹配百度网盘分享链接，跳过');
    return;
  }

  gopeed.logger.info('匹配到百度网盘分享链接');

  if (!gopeed.settings.bdcookie) {
    gopeed.logger.error('BDUSS Cookie 未配置');
    throw new Error('请先在扩展设置中配置百度网盘 Cookie (BDUSS)');
  }

  try {
    const u = new URL(url);
    const surl = u.pathname.split('/')[2];
    const search = u.searchParams;
    let pwd = '';
    if (search && search.get('pwd')) {
      pwd = search.get('pwd');
    }

    gopeed.logger.info('surl:', surl, 'pwd:', pwd);

    if (!surl) {
      gopeed.logger.error('无法提取 surl');
      return;
    }

    const shareClient = new ShareClient(surl, pwd, gopeed.settings.bdcookie);

    gopeed.logger.info('开始获取分享信息...');
    const shareInfo = await shareClient.getShareInfo();
    gopeed.logger.info('分享信息:', JSON.stringify(shareInfo));

    const name =
      shareInfo.title.split('/').pop() +
      (shareInfo.list.length > 1 ? '等' : '');
    const parentDir =
      shareInfo.title.split('/').slice(0, -1).join('/') + '/';

    gopeed.logger.info('开始获取文件列表...');
    const fileList = await shareClient.getFileList();
    gopeed.logger.info('文件数量:', fileList.length);
    gopeed.logger.debug('fileList', JSON.stringify(fileList));

    if (!fileList || fileList.length === 0) {
      gopeed.logger.error('文件列表为空');
      return;
    }

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

    gopeed.logger.info('解析完成，返回', fileList.length, '个文件');
  } catch (error) {
    gopeed.logger.error('解析失败:', error.message);
    gopeed.logger.error('错误堆栈:', error.stack);
    throw error;
  }
});

gopeed.events.onStart(async (ctx) => {
  try {
    await updateDlink(ctx.task);
  } catch (error) {
    gopeed.logger.error('onStart 获取下载链接失败:', error.message);
    // 不抛出错误，让任务继续，下载时会触发 onError 重试
  }
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
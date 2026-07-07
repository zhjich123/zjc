import { deepFileList } from '../util.js';

const API_URL = 'https://pan.baidu.com';

class ShareClient {
  constructor(surl, pwd, bdcookie) {
    this.surl = surl;
    this.pwd = pwd;
    this.bdcookie = bdcookie;
    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Cookie: bdcookie,
      Referer: 'https://pan.baidu.com/disk/main',
    };
  }

  async getShareInfo() {
    const resp = await fetch(
      `${API_URL}/share/wxlist?channel=weixin&version=2.2.2&clienttype=25&web=1`,
      {
        method: 'POST',
        headers: this.headers,
        body: `pwd=${this.pwd}&shorturl=${this.surl}&root=1`,
      }
    );
    const result = await resp.json();
    if (result.errno != 0) {
      throw new Error('获取分享信息失败，errno=' + result.errno);
    }
    return result.data;
  }

  async getFileList() {
    return await deepFileList(this._doGetList.bind(this), '');
  }

  async getDlink(fid) {
    gopeed.logger.info('获取下载链接，fid=', fid);
    const { uk, shareid, seckey } = await this.getShareInfo();

    const bdstokenResp = await fetch(
      `${API_URL}/api/gettemplatevariable?fields=["bdstoken"]`,
      {
        headers: this.headers,
      }
    );
    const bdstokenResult = await bdstokenResp.json();
    if (bdstokenResult.errno != 0) {
      throw new Error('获取bdstoken失败，errno=' + bdstokenResult.errno);
    }
    const bdstoken = bdstokenResult.result.bdstoken;
    gopeed.logger.debug('bdstoken:', bdstoken);

    const signResp = await fetch(
      `${API_URL}/share/tplconfig?surl=${this.surl}&fields=sign,timestamp&channel=chunlei&web=1&app_id=250528&bdstoken=${bdstoken}&clienttype=0`,
      {
        headers: this.headers,
      }
    );
    const signResult = await signResp.json();
    if (signResult.errno != 0) {
      throw new Error('获取签名失败，errno=' + signResult.errno);
    }
    const { sign, timestamp } = signResult.data;
    gopeed.logger.debug('sign:', sign);
    gopeed.logger.debug('timestamp:', timestamp);

    const durlResp = await fetch(
      `${API_URL}/api/sharedownload?channel=chunlei&clienttype=5&web=1&app_id=250528&sign=${sign}&timestamp=${timestamp}`,
      {
        method: 'POST',
        headers: this.headers,
        body: `encrypt=0&extra={"sekey":"${seckey}"}&product=share&timestamp=${timestamp}&uk=${uk}&primaryid=${shareid}&fid_list=[${fid}]&type=nolimit`,
      }
    );
    const durlResult = await durlResp.json();
    if (durlResult.errno != 0) {
      throw new Error('获取dlink失败，errno=' + durlResult.errno);
    }
    const dlink = durlResult.list[0].dlink;
    gopeed.logger.debug('dlink:', dlink);

    const dlinkParts = dlink.split('?')[1];
    const realDurlResp = await fetch(
      `https://d.pcs.baidu.com/rest/2.0/pcs/file?app_id=250528&method=locatedownload&check_blue=1&es=1&esl=1&ant=1&${dlinkParts}&ver=4.0&dtype=1&err_ver=1.0&ehps=1&eck=1&vip=2&open_pflag=0&wp_retry_num=2&dpkg=1&sd=0&clienttype=9&version=3.0.20.18&channel=0&version_app=7.44.7.1`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'netdisk;11.4.51.4.19',
          Cookie: this.headers.Cookie,
        },
      }
    );
    const realDurlResult = await realDurlResp.json();
    if (realDurlResult.urls == undefined || realDurlResult.urls.length < 1) {
      throw new Error('获取真实下载链接失败 urls.length < 1');
    }
    let realDlink = '';
    for (const url of realDurlResult.urls) {
      if (url.url.includes('allall')) {
        realDlink = url.url;
        break;
      }
    }
    if (realDlink === '') {
      realDlink = realDurlResult.urls[0].url;
    }
    gopeed.logger.debug('realDlink:', realDlink);
    return realDlink;
  }

  async _doGetList(dir) {
    const root = dir === '' ? 1 : 0;
    let page = 1;
    let hasMore = true;
    let list = [];
    while (hasMore) {
      const data = await this._doGetPageList(dir, root, page);
      list = list.concat(data.list);
      hasMore = data.has_more;
      page++;
    }
    return list;
  }

  async _doGetPageList(dir, root, page) {
    const resp = await fetch(
      'https://pan.baidu.com/share/wxlist?channel=weixin&version=2.2.2&clienttype=25&web=1',
      {
        method: 'POST',
        headers: this.headers,
        body: `dir=${encodeURIComponent(dir)}&num=1000&order=time&page=${page}&pwd=${this.pwd}&root=${root}&shorturl=${this.surl}`,
      }
    );
    const result = await resp.json();
    if (result.errno != 0) {
      throw new Error('解析文件列表失败，errno=' + result.errno);
    }
    return result.data;
  }

  async getFileListWithInfo() {
    const files = await deepFileList(this._doGetList.bind(this), '');
    for (const file of files) {
      if (!file.filename && file.server_filename) {
        file.filename = file.server_filename;
      }
    }
    return files;
  }
}

export default ShareClient;

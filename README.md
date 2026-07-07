# 百度网盘分享链接解析扩展

一个用于 Gopeed 下载器的扩展，支持解析百度网盘分享链接并下载文件。

## ✨ 功能特性

- ✅ 支持百度网盘分享链接解析
- ✅ 自动处理提取码（pwd 参数）
- ✅ 递归遍历分享文件夹中的所有文件
- ✅ 获取真实下载地址
- ✅ 下载出错自动重试

## 📦 安装

### 方式一：Gopeed 扩展商店安装

在 Gopeed 中打开扩展页面，输入以下地址并安装：

```
https://github.com/zhjich123/zjc
```

### 方式二：手动安装

1. 下载本扩展代码
2. 运行 `npm install && npm run build` 构建项目
3. 在 Gopeed 中选择"加载已解压的扩展"，选择扩展目录

## 🔧 配置

安装完成后，需要配置百度网盘 Cookie：

1. 在浏览器中登录百度网盘网页版
2. 按 F12 打开开发者工具
3. 切换到 Application → Cookies → https://pan.baidu.com
4. 找到 `BDUSS`，复制其值
5. 在 Gopeed 扩展设置中粘贴 BDUSS 值并保存

## 🚀 使用方法

1. 复制百度网盘分享链接（格式：`https://pan.baidu.com/s/xxx?pwd=xxx`）
2. 在 Gopeed 中新建任务，粘贴链接
3. 扩展会自动解析分享链接并获取文件列表
4. 选择要下载的文件，点击开始下载

## 📝 注意事项

- 此扩展需要百度网盘 Cookie (BDUSS) 才能工作
- 下载速度取决于你的百度网盘会员等级
- 分享链接必须是有效的、未过期的
- 如果遇到下载失败，扩展会自动尝试重新获取下载链接

## 📄 许可证

MIT License

## 🔗 相关链接

- [Gopeed 下载器](https://gopeed.com/)
- [Gopeed 官方文档](https://gopeed.com/docs/)

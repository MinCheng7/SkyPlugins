/**
 * function: 获取【什么值得买】Cookie
 * Author: @MinCheng7
 * Original author: @fmz200
 * date: 2026-04-16
 * 搭配签到脚本使用，脚本地址：https://raw.githubusercontent.com/MinCheng7/SkyPlugins/refs/heads/main/smzdm-cookie.js
 */

const req_url = $request.url;
const req_headers = $request.headers;

try {
  if (req_url.includes("/user-api.smzdm.com/users/info")) {
    const cookie = req_headers['Cookie'] || req_headers['cookie'];
    
    // 匹配smzdm_id
    let regex = /smzdm_id=(\d+)/;
    let match = cookie.match(regex);
    let smzdm_id = match ? match[1] : "";
    
    console.log(smzdm_id + " 获取到的Cookie：" + cookie);

    // 使用 Loon 原生 API 读取缓存
    let cache = $persistentStore.read("mincheng7_smzdm_cookie") || "[]";
    let json_data = JSON.parse(cache);
    
    updateOrAddObject(json_data, "smzdm_id", smzdm_id, "cookie", cookie);
    const cacheValue = JSON.stringify(json_data, null, "\t");

    // 使用 Loon 原生 API 写入缓存
    $persistentStore.write(cookie, 'SMZDM_COOKIE');
    $persistentStore.write(cacheValue, 'mincheng7_smzdm_cookie');
    
    // 使用 Loon 原生 API 发送通知
    $notification.post('什么值得买 获取cookie成功✅', "", "账号ID: " + smzdm_id);
  }
} catch (e) {
  console.log('脚本运行出现错误：' + e.message);
  $notification.post('获取Cookie脚本运行出现错误❗️', "", e.message);
}

// 释放请求，让APP正常加载
$done({});

/**
 * 核心功能函数：更新或添加多账号数据
 */
function updateOrAddObject(collection, ...args) {
  if (args.length % 2 !== 0) {
    throw new Error('Arguments must be provided in pairs.');
  }

  for (let i = 0; i < args.length; i += 2) {
    const id = args[i];
    const key = args[i + 1];
    const index = collection.findIndex(obj => obj[id] === key);

    if (index !== -1) {
      for (let j = i + 2; j < args.length; j += 2) {
        const id2 = args[j];
        const value = args[j + 1];
        collection[index][id2] = value;
      }
    } else {
      const newObj = {};
      for (let j = i; j < args.length; j += 2) {
        newObj[args[j]] = args[j + 1];
      }
      collection.push(newObj);
      break; 
    }
  }
}

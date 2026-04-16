/**
 * function: 获取什么值得买Cookie脚本
 * Author: @MinCheng7
 * Original author: @fmz200
 * date: 2024-11-10 15:00:00
 */

const $ = new API("获取什么值得买Cookie脚本");
const req_url = $request.url;
const req_headers = $request.headers;

try {
  /**
   * 什么值得买
   * 手机APP进入我的页面查看个人资料，即可获取cookie
   */
  if (req_url.includes("/user-api.smzdm.com/users/info")) {
    const cookie = req_headers['Cookie'] || req_headers['cookie'];
    
    // 使用正则表达式匹配smzdm_id=数字 的模式
    let regex = /smzdm_id=(\d+)/;
    let match = cookie.match(regex);
    let smzdm_id = match ? match[1] : "";
    
    console.log(smzdm_id + " 获取到的数据：" + cookie);

    // 读取并解析缓存
    let cache = $.read("#fmz200_smzdm_cookie") || "[]";
    let json_data = JSON.parse(cache);
    
    // 更新或新增账号信息
    updateOrAddObject(json_data, "smzdm_id", smzdm_id, "cookie", cookie);
    const cacheValue = JSON.stringify(json_data, null, "\t");

    // 写入缓存并通知
    $.write(cookie, '#SMZDM_COOKIE');
    $.write(cacheValue, '#fmz200_smzdm_cookie');
    $.notify('什么值得买 获取cookie成功✅', "", "账号ID: " + smzdm_id);
    console.log('什么值得买 获取到的ck为：' + cookie);
  }
} catch (e) {
  console.log('脚本运行出现错误：' + e.message);
  $.notify('获取Cookie脚本运行出现错误❗️', "", e.message);
}

$.done();

/**
 * 核心功能函数：更新或添加对象到集合中（多账号支持）
 * 接受可变数量的参数对（id, key）
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
      // 如果找到了，则更新对应的属性值
      for (let j = i + 2; j < args.length; j += 2) {
        const id2 = args[j];
        const value = args[j + 1];
        collection[index][id2] = value;
      }
    } else {
      // 如果未找到，则新增一个对象并添加到集合中
      const newObj = {};
      for (let j = i; j < args.length; j += 2) {
        newObj[args[j]] = args[j + 1];
      }
      collection.push(newObj);
      break; // 新增后退出循环
    }
  }
}

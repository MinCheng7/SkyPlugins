/*
哔哩哔哩每日任务和奖励
作者: @Mincheng7, 原作者: MartinsKing(@ClydeTime)
更新时间: 2026-04-17
功能: 登录/观看/分享/投币/直播签到/银瓜子转硬币/大会员积分签到/年度大会员每月B币券/等级任务
改进内容：新增智能参数解析器，适配Loon UI配置丨通知样式调整
注意事项:
	Ⅰ. 抓取cookie时注意保证账号登录状态;
	Ⅱ. cookie获取完成后建议关闭插件内的cookie开关;
	Ⅲ. 账号内须有一定数量的关注数，否则无法完成投币;
	Ⅳ. 年度大会员每月B币券会在每月1号、15号尝试领取，确保应用正常运行, 以防漏领;
	Ⅴ. 自动充电在每次领劵之后进行, 默认为自己充电, 可在插件内设置为其他用户充电;
	Ⅵ. 如果需要修改投币数量, 请在插件内设置, 没有设置则默认5个, 已经设置的优先使用插件内的设置;
	Ⅶ. 脚本执行时间的参数填写标准的Cron表达式。例如 "40 7 * * *" 表示每天早上 7:40 执行，依次为 "分 时 天 月 年"。
使用声明: ⚠️此脚本仅供学习与交流，请勿贩卖！⚠️
脚本参考: @Nobyda, @Wyatt1026, @ABreadTree, @chavyleung, @SocialSisterYi, @catlair  
************************
Loon 插件:
# BiliDailyBonus 「在插件中添加」
https://raw.githubusercontent.com/MinCheng7/SkyPlugins/refs/heads/main/plugins/BiliDailyBonus.plugin
************************
*/

const format = (ts, fmt = 'yyyy-MM-dd HH:mm:ss') => {
	return $.time(fmt, ts)
}

const check = key =>
	!config.hasOwnProperty(key) ||
	!config[key].hasOwnProperty("time") ||
	!(config[key]["num"] > 0) ||
	format(new Date().toDateString()) > config[key].time

const string2object = cookie => {
	let obj = {}
	let arr = cookie.split("; ")
	arr.forEach(function (val) {
		let array = val.split("=")
		obj[array[0]] = array[1]
	})
	return obj
}

const isNotComplete = exec_times => 
	config.user.num === 0 ||
	config.watch.num === 0 ||
	config.share.num === 0 ||
	(config.coins.num < exec_times * 10 && Math.floor(config.user.money) > 5)

const generateSign = body => md5(
	$.queryStr(Object.fromEntries(new Map(Array.from(Object.entries(body)).sort()))) 
	+ 'c2ed53a74eeefe3cf99fbd01d8c9c375'
)

const persistentStore = config => {
	const PStoreConfig = $.getItem($.name + "_daily_bonus", {})
	const isCookieValid = PStoreConfig.cookie?.bili_jct === config.cookie.bili_jct
	const isSameUser = PStoreConfig.cookie?.DedeUserID === config.cookie.DedeUserID
	if (PStoreConfig.cookie && !isCookieValid) {
		!isSameUser && (config = PStoreConfig?.Settings ? {...config, Settings: PStoreConfig.Settings} : config)
		config.FirstInsert = false
	} else if (PStoreConfig.cookie) {
		return $.log("🍪 cookie未失效,无需更新")
	} else {
		config.FirstInsert = true
	}
	const isFirstInsert = config.FirstInsert
	delete config.FirstInsert
	const successMessage = $.setItem($.name + "_daily_bonus", $.toStr(config))
		? "🍪 cookie存储成功 ⭕"
		: "🍪 cookie存储失败 ❌"
	$.msg($.name, isFirstInsert ? "首次获取cookie" : "检测到cookie已更新", successMessage)
	$.log($.name + ": " +`${isFirstInsert ? "首次获取cookie" : "检测到cookie已更新"}`)
	$.log(successMessage)
}

const $ = new Env("哔哩哔哩每日任务")
const startTime = format()
let cards = []
let config = $.getItem($.name + "_daily_bonus", {});
[['cookie'], ['user'], ['watch'], ['share'], ['coins']].forEach(key => !config[key] && (config[key] = {})) //init config

const baseHeaders = {
	'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/621.1.15.10.7 (KHTML, like Gecko) Mobile/22E252 BiliApp/84400100 os/ios model/iPhone 16 Pro Max mobi_app/iphone build/84400100 osVer/18.3 network/2 channel/AppStore c_locale/zh-Hans_CN s_locale/zh-Hans_CN disable_rcmd/0',
	'cookie': config.cookieStr
}


!(async () => {
	if ("object" === typeof $response) {
		if(!config.matchTime || (Date.now() - config.matchTime) > 10000) {
			config.matchTime = Date.now()
			$.setItem($.name + "_daily_bonus", $.toStr(config))
		} else {
			if ((Date.now() - config.matchTime) < 10000) return $.log("- Blocked: interval <10s")
		}
		$.log("🍪 正在获取cookie, 请稍后")
		await getCookie()
	} else if ("object" === typeof $request) {  
		let Cookie = $request.headers.cookie || $request.headers.Cookie
		if (Cookie) {
			config.cookie = string2object(Cookie)
			if (config.cookie.DedeUserID) {
				const url = $request.url
				config.key = url.match(/.*access_key=(.*?)&/)?.[1]
				config.cookieStr = `DedeUserID=${config.cookie.DedeUserID}; DedeUserID__ckMd5=${config.cookie.DedeUserID__ckMd5}; SESSDATA=${config.cookie.SESSDATA}; bili_jct=${config.cookie.bili_jct}; sid=${config.cookie.sid}`
			} else {
				return $.msg($.name, "❌ 获取cookie信息异常")
			}
			persistentStore(config)
		} else {
			$.msg($.name, "❗ 未发现有效cookie信息")
		}
	} else {
		await signBiliBili()
	}
})()
	.catch((e) => $.logErr(e))
	.finally(() => $.done())

async function getCookie() {
	const qrCode = await getQrcode()
	if (qrCode === "0") return $.msg($.name, "❌ 获取二维码失败！")
	await $.wait(10000)
	await waitConfirmLoop(0, await loginConfirm(qrCode), qrCode)
}

async function signBiliBili() {
	if (config.cookie && await me()) {
		// 集中读取全部插件配置参数 (使用 Loon 原生 $argument)
		const exec_times = ($argument.CoinNum !== undefined && $argument.CoinNum !== "") ? Number($argument.CoinNum) : Number(config.Settings?.exec ?? 5);
		const s2cSwitch = ($argument.Silver2Coin === 'true' || $argument.Silver2Coin === true);
		const chargeSwitch = ($argument.AutoCharge === 'true' || $argument.AutoCharge === true);
		const customMid = $argument.ChargeMid || "";
		const customBP = $argument.ChargeBP || "";

		// 传入动态投币数量，以便日志准确显示
		await queryStatus(exec_times);
				
		const real_times = Math.max(0, exec_times - (Number(config.coins.num) / 10));
		let flag = isNotComplete(exec_times);
		
		if (flag){
			await dynamic()
			if (cards.length) {
				let item = cards[Math.floor(Math.random() * cards.length)]
				let card = $.toObj(item.card)
				short_link = encodeURIComponent(card?.short_link_v2.replace(/\\\//g, '/'))
				await watch(item.desc.rid, item.desc.bvid, card.cid)
				
				$.log("  ⏳ 等待 1 秒后分享...")
				await $.wait(1000)
				
				await share(item.desc.rid, card.cid, short_link)
			} else {
				$.log("❌ 获取视频失败,请重试或寻求帮助")
			}
			
			$.log("  ⏳ 等待 1 秒后进入投币...")
			await $.wait(1000)

			$.log("3️⃣ 投币任务")
			config.coins?.failures > 0 && (config.coins.failures = 0)//重置投币失败次数
			if (real_times === 0){
				$.log(`⭕ 今日已完成投币目标 (设定数: ${exec_times})`)
			} else {
				for (let i = 0; i < real_times && (Math.floor(config.user.money) > 5 || ($.log("- 硬币不足,投币失败"), false)); i++) {
					await coin()
					if (i < real_times - 1) {
						$.log("  ⏳ 等待 0.1 秒后继续投币...")
						await $.wait(100)
					}
				}
			}
			
			// 新增：在投币结束后打印剩余数量
			$.log(`  🪙 硬币剩余数量: ${Math.floor(config.user.money)}`)
			
			$.log("\n---- ⭕ 经验值任务已完成 ----\n")
		} else {
			$.log("\n---- ⭕ 经验值任务已完成 ----\n")
		}
		
        let silverLogMsg = ''; 
		if (s2cSwitch) { 
    		silverLogMsg = await silver2coin(); 
		} else {
    		$.log("跳过银瓜子换硬币任务（未启用）");
		}
		
		let vipMessage = ''
		if (config.user.vipStatus === 1) {
			$.log("\n---- 🫅 开始大会员额外任务 ----\n")
			const experience = await vipExtraExStatus()
			let vipExtraExRet = false
			experience === 0 ? $.log("❌ 大会员额外经验领取情况查询失败")
				: experience?.state === 0 ? vipExtraExRet = await vipExtraEx() 
					: ($.log("⭕ 今日额外经验任务已完成"), vipExtraExRet = true)
			const signStatus =  await bigScoreSignStatus()  
			let bigScoreSignRet = false
			signStatus === 0 ? $.log("❌ 大积分三日签到任务完成情况查询失败")
				: signStatus?.three_day_sign?.signed === false ? bigScoreSignRet = await bigScoreSign()
					: ($.log("⭕ 今日大积分三日签到任务已完成"), bigScoreSignRet = true)
			const scoreStatus = await bigScoreStatus()
			if (scoreStatus === 0) $.log("❌ 大积分完成情况查询失败")

			const commonTaskItem = scoreStatus.task_info?.modules?.find(item => item.module_title === "日常任务")?.common_task_item || null
			const tasks = 
				[{ code: "dress-view", fn: bigScoreDressView, title: "浏览装扮商城主页", success: false },
				{ code: "vipmallview", fn: bigScoreVipMallView, title: "浏览会员购页面10秒", success: false },
				{ code: "filmtab", fn: bigScoreFilmTab, title: "浏览影视频道页10秒", success: false },
				{ code: "animatetab", fn: bigScoreAnimateTab, title: "浏览追番频道页10秒", success: false },
				{ code: "ogvwatchnew", fn: bigScoreOgvWatchNew, title: "观看剧集内容", success: false }]
			if (!commonTaskItem) {
				for (let t in tasks) tasks[t].success = await tasks[t].fn()
			} else {
				for (let t in tasks) commonTaskItem.find(i => i.task_code === tasks[t].code)?.state !== 3 ? tasks[t].success = ($.log(`\n开始${tasks[t].title}`), await tasks[t].fn()) : ($.log(`⭕ 今日${tasks[t].title}任务已完成`), tasks[t].success = true)
			}
			const unfinishedTask = tasks.filter(task => !task.success).map(task => task.title)
			let taskMessage = unfinishedTask.join(', ')
			taskMessage += taskMessage === "观看剧集内容" ? (config.task_id && config.token ? "等待完成" : "执行失败") : "执行失败"
			vipMessage += `\n` + '大会员额外经验领取' + `${vipExtraExRet ? "成功 ⭕" : "失败"}\n` + 
											'大积分三日签到' + `${bigScoreSignRet ? "成功 ⭕" : "失败"}\n` + 
											'大积分系列任务' + `${unfinishedTask.length === 0 ? "完成 ⭕" : taskMessage}`
			
			const day = $.time('dd')
			if (day === '1' || day === '15') {
				const privileges = 
				[{ code: 1, title: "年度大会员每月B币券" },
				{ code: 2, title: "年度大会员每月会员购优惠券" },
				{ code: 3, title: "年度大会员每月漫画福利券成功" },
				{ code: 4, title: "年度大会员每月会员购包邮券成功" },
				{ code: 5, title: "年度大会员每月漫画商城优惠券成功" },
				{ code: 6, title: "大会员每月装扮体验卡成功" },
				{ code: 7, title: "大会员每月课堂优惠券成功" }]
				if (config.user.vipType === 2) {
					for (const {code, title} of privileges) await vipPrivilege(code) && (code === 1 ? $.msg(title, "🎉🎉🎉领取成功", `🎉 领取${title}成功`) : $.log(`🎉 领取${title}成功`))
					await $.wait(800) 
                    
					let chargeLogMsg = ''; 
					if (chargeSwitch) {
						const finalMid = (customMid !== "") ? customMid : (config.Settings?.charge_mid || config.user.mid);
						const finalBP = (customBP !== "") ? Number(customBP) : (config.Settings?.bp_num || 5);
						chargeLogMsg = await Charge(finalMid, finalBP); 
					} else {
						$.log("\n跳过自动充电任务（未启用）");
					}
				} else {
					for (const code of [6, 7]) await vipPrivilege(code) && $.log(`- 领取${privileges.find(p => p.code === code).title}成功`)
				}
			} 
		}
		flag = !isNotComplete(exec_times)
		let title = `---- 🗒️ ${$.name} ----\n登录${config.user.num}丨观看${config.watch.num}丨分享${config.share.num}丨投币${config.coins.num / 10}${flag ? " 已完成 🎉" : " 未完成 ❗"}`
		$.log(`\n ${title}`)
		$.log(`📺 登录时间: ${config.user.time || "暂无"}`)
		$.log(`🎦 观看时间: ${config.watch.time || "暂无"}`)
		$.log(`💬 分享时间: ${config.share.time || "暂无"}`)
		$.log(`💸 投币时间: ${config.coins.time || "暂无"}`)

		let expInfo = config.user.level_info.current_level < 6 
    		? `经验: ${config.user.level_info.current_exp}/下级${config.user.level_info.next_exp}/满级28800\n等级:当前${config.user.level_info.current_level}级 升满级最快需${Math.max(0, Math.ceil(config.user.v6_exp / 65))}天`
    		: `经验: ${config.user.level_info.current_exp} 丨 Lv 6 (已满级)`;

		// 核心优化：使用数组拼接文本，利用 trim() 消除自带的隐藏换行符，完美杜绝空行
		let contentArr = [expInfo];
		if (silverLogMsg) contentArr.push(silverLogMsg.trim());
		contentArr.push(`硬币数量: ${Math.floor(config.user.money)} 🪙`);
		if (typeof chargeLogMsg !== 'undefined' && chargeLogMsg) contentArr.push(chargeLogMsg.trim());

		notice = {
			title: `BiliBili「${config.user.uname}」`,
			subTitle: `${flag ? "⭕ 今日任务已完成 ~" : "❗️ 有未完成的任务"}`,
			content: contentArr.join('\n')
		}
		
		// 增加媒体图片及点击跳转协议
		$.msg(notice.title, notice.subTitle, notice.content, {
			'open-url': 'bilibili://', // 点击通知直接打开 B 站客户端
			'media-url': 'https://raw.githubusercontent.com/MinCheng7/icons/refs/heads/main/logo/2233-2.jpg' // B 站专属图标
		})
	} else {
		$.msg(`❌ ${$.name} 任务失败`,`📅 ${startTime}`, "🤒请更新cookie")
	}
}

async function waitConfirmLoop(times, login_confirm, qrCode) {
	if (times >= 3) return $.msg("❌ 扫码确认失败！")
	if (login_confirm) return
	await $.wait(5000)
	await waitConfirmLoop(++times, await loginConfirm(qrCode), qrCode)
}

async function getQrcode() {
	const body = {
		appkey: "27eb53fc9058f8c3",
		local_id: 0,
		ts: $.getTimestamp(),
		mobi_app: 'iphone'
	}
	body.sign = generateSign(body)
	const myRequest = {
		url: "https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
		},
		body: $.queryStr(body)
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body.code === 0 && body.message === "0") {
				let media_url = `https://tool.lu/qrcode/basic.html?text=https://passport.bilibili.com/x/passport-tv-login/h5/qrcode/auth?auth_code=${body.data.auth_code}&mobi_app=iphone`
				$.msg($.name + "扫码", "使用客户端扫描二维码", "请20s内完成扫码,长按推送放大二维码或点击推送跳转网页获取二维码", { 'open-url': media_url, 'media-url': media_url })
				$.log("二维码已生成，如在通知中获取图片失败，请20s内使用浏览器打开以下地址\n" + `${media_url}`)
				return body.data.auth_code
			} else {
				$.log("❌ 生成Qrcode失败")
				return "0"
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function loginConfirm(auth_code) {
	const body = {
		appkey: "27eb53fc9058f8c3",
		auth_code,
		local_id: 0,
		ts: $.getTimestamp()
	}
	body.sign = generateSign(body)
	const myRequest = {
		url: "https://passport.bilibili.com/x/passport-tv-login/qrcode/poll",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
		},
		body: $.queryStr(body)
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body.code === 0 && body.message === "0") {
				$.log("⭕ 确认登录成功")
				const cookieStr = body.data.cookie_info.cookies.map(c => `${c.name}=${c.value}`).join('; ');
				[config.cookieStr, config.cookie, config.key] = [cookieStr, string2object(cookieStr), body.data.access_token];
				persistentStore(config)
			}
			switch (body.code) {
				case 0:
					$.msg("⭕ 扫码确认成功！")
					return true
				case 86038:
					$.msg("❌ 二维码已失效")
					return false
				default:
					return false
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function watch(aid, bvid, cid) {
	$.log("1️⃣ 观看(登录)任务")
	if (check("watch")) {
		$.log(`    正在观看(登录)(${bvid})`)
		const body = {
			aid,
			cid,
			bvid,
			mid: config.user.mid,
			csrf: config.cookie.bili_jct,
			played_time : 1,
			real_played_time: 1,
			realtime: 1,
			start_ts: $.getTimestamp(),
			type: 3,
			dt: 2,
			play_type: 0,
			from_spmid: 0,
			spmid: 0,
			auto_continued_play: 0,
			refer_url: "https%3A%2F%2Ft.bilibili.com%2F",
			bsource: ""
		}
		const myRequest = {
			url: 'https://api.bilibili.com/x/click-interface/web/heartbeat',
			headers: {
				...baseHeaders,
				"referrer": `https://www.bilibili.com/video/${bvid}`
			},
			body: $.queryStr(body)
		}
		await $.fetch(myRequest).then(response => {
			const body = $.toObj(response.body)
			if (body?.code === 0) {
				$.log(`🎦 累计观看(登录)次数 ${(config.watch.num || 0) + 1}`)
				config.user.num = (config.user.num || 0) + 1
				config.watch.num = (config.watch.num || 0) + 1
				$.setItem($.name + "_daily_bonus", $.toStr(config))
			} else {
				$.log("❌ 观看失败，" + body?.message)
			}
		})
	} else {
		$.log(`⭕ 今日已观看 记录于${config.watch.time}`)
	}
}

async function share(aid, cid, short_link) {
	$.log("2️⃣ 分享任务")
	if (check("share")) {
		$.log("💬 正在分享")
		const body = {
			access_key: config.key,
			actionKey: 'appkey',
			appkey: '27eb53fc9058f8c3',
			build: '72700100',
			c_locale: 'zh-Hans_CN',
			device: 'phone',
			disable_rcmd: 0,
			link: short_link,
			mobi_app: 'iphone',
			object_extra_fields: '%7B%7D',
			oid: aid,
			panel_type: 1,
			platform: 'ios',
			s_locale:'zh-Hans_CN',
			share_channel: 'WEIXIN',
			share_id: 'main.ugc-video-detail.0.0.pv',
			share_origin: 'vinfo_share',
			sid: cid,
			spm_id: 'main.ugc-video-detail.0.0',
			statistics: '%7B%22appId%22%3A1%2C%22version%22%3A%228.44.0%22%2C%22abtest%22%3A%22%22%2C%22platform%22%3A1%7D',
			success: 1,
			ts: $.getTimestamp()
		}
		body.sign = generateSign(body)
		const myRequest = {
			url: 'https://api.bilibili.com/x/share/finish',
			headers: {},
			body: $.queryStr(Object.fromEntries(new Map(Array.from(Object.entries(body)).sort())))
		}
		await $.fetch(myRequest).then(response => {
			const body = $.toObj(response.body)
			if (body?.code === 0) {
				config.share.num = (config.share.num || 0) + 1
				$.log("⭕ 分享成功")
				$.setItem($.name + "_daily_bonus", $.toStr(config))
			} else {
				$.log("❌ 分享失败，" + body?.message)
			}
		})
	} else {
		$.log(`⭕ 今日已分享 记录于${config.share.time}`)
	}
}

async function coin() {
	if (config.coins.num >= 50) {
		$.log(`⭕ 今日已完成 记录于${config.coins.time}`)
		return
	}
	let like_uid_list = await getFavUid()
	if (like_uid_list && like_uid_list.length > 0) {
		let aid = await getFavAid(like_uid_list)
		if (aid !== 0) {
			const body = {
				access_key: config.key,
				aid,
				multiply: 1,
				select_like: 0,
			}
			const myRequest = {
				url: "https://app.bilibili.com/x/v2/view/coin/add",
				headers: {
					...baseHeaders,
					'accept-encoding': 'gzip, deflate, br',
					'content-type': 'application/x-www-form-urlencoded',
					'app-key': 'iphone'
				},
				body: $.queryStr(body)
			}
			await $.fetch(myRequest).then(async response => {
				try {
					const body = $.toObj(response.body)
					if (body?.code === 0 && (body?.message === "0" || body?.message === "OK")) {
						$.log("⭕ 投币成功")
						config.user.money -= 1
						config.coins.num += 10
						config.coins.time = startTime
						$.setItem($.name + "_daily_bonus", $.toStr(config))
					} else {
						$.log("❌ 投币失败，" + body.message)
						config.coins.failures = (config.coins.failures === 0 || typeof config.coins.failures === 'undefined' ? 1 : config.coins.failures + 1)
						$.setItem($.name + "_daily_bonus", $.toStr(config))
						if (config.coins.failures < 11) {
							$.log("❗ 正在重试...重试次数 " + (config.coins.failures - 1) + "(超过十次不再重试)")
							await $.wait(300) 
							await coin()
						}
					}
				} catch (e) {
					$.logErr(e, response)
				}
			})
		} else {
			$.log("❌ 获取随机投币视频失败")
		}
	} else {
		$.log("❌ 获取随机关注用户列表失败")
	}
}

async function getFavUid() {
	const myRequest = {
		url: `https://api.bilibili.com/x/relation/followings?vmid=${config.cookie.DedeUserID}&ps=10&order_type=attention`,
		headers: {
			...baseHeaders
		}
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			let like_uid_list = new Array()
			if (body?.code === 0) {
				$.log("💌 获取关注列表成功")
				let like_list = body?.data?.list
				for (let i = 0; i < like_list.length; i ++) {
					like_uid_list[i] = like_list[i].mid
				}
				return like_uid_list
			} else {
				$.log("❌ 获取关注列表失败，" + body?.message)
				return like_uid_list
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function getFavAid(arr) {
	let random_int = Math.floor((Math.random()*arr.length))
	let random_mid = arr[random_int]
	let wbiSigns = getWbiSigns({mid: random_mid})
	const myRequest = {
		url: `https://api.bilibili.com/x/space/wbi/arc/search?${wbiSigns}`,
		headers: {
			...baseHeaders,
			'referer': 'https://space.bilibili.com'
		}
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body.data?.list?.vlist.some(Boolean)) {
				$.log("⭕ 获取投币视频成功")
				let vlist = body.data?.list?.vlist
				let random_v_int = Math.floor((Math.random() * vlist.length))
				let aid = vlist[random_v_int]?.aid
				$.log("🧑‍💻 [" + vlist[random_v_int]['author'] + "]\n🎞️ 《" + vlist[random_v_int]['title'] + "》")
				return aid
			} else {
				$.log("❌ 获取投币视频失败，" + body?.message)
				return 0
			}
		} catch (e) {
			$.logErr(e, response)
		}
	}, reason => {
		$.log("❌ 获取投币视频失败，" + $.toStr(reason))
		return 0
	})
}

async function silver2coin() {
	$.log("\n---- 🪙 银瓜子兑换硬币任务 ----\n")
    let silverMessage = ''; 
	const body = {
		csrf: config.cookie.bili_jct,
		csrf_token: config.cookie.bili_jct
	}
	const myRequest = {
		url: "https://api.live.bilibili.com/xlive/revenue/v1/wallet/silver2coin",
		headers: {
			'cookie': config.cookieStr
		},
		body: $.queryStr(body)
	}
	await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body && body.code === 0) {
				$.log(`⭕ 成功兑换: ${body.data.coin}个硬币`)
				$.log(`当前银瓜子: ${body.data.silver} , 当前金瓜子: ${body.data.gold}`)
                silverMessage = `银瓜子兑换硬币成功 ⭕\n`; 
			} else if (body && body.code === 403) {
				$.log("❌ 未成功兑换，" + body?.message)
                silverMessage = `银瓜子兑换硬币失败 ❌\n`; 
			} else {
				let subTitle = "❌ 兑换失败"
				let detail = ` ${body.message}`
				$.log(subTitle + ", " + detail)
                silverMessage = `银瓜子兑换硬币失败 ❌\n`; 
			}
		} catch (e) {
			$.logErr(e, response)
            silverMessage = `银瓜子兑换硬币执行异常 ❌\n`; 
		}
	})
    return silverMessage; 
}

async function liveSign() {
	$.log("\n---- ✍️ 直播签到任务 ----\n")
	const myRequest = {
		url: "https://api.live.bilibili.com/xlive/web-ucenter/v1/sign/DoSign",
		headers: {
			...baseHeaders
		}
	}
	await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0) {
				$.log("⭕ 签到成功")
				$.log(`签到奖励:${body.data.text},连续签到${body.data.hadSignDays}天`)
			} else if (body && body.code === 1011040){
				$.log("⭕ 今日已完成")
			} else {
				$.log("❌ 签到失败，" + body?.message)
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreSign() {
	$.log("\n---- 大会员大积分签到任务 ----\n")
	if (check("score")) {
		const myRequest = {
			url: `https://api.bilibili.com/pgc/activity/score/task/sign2?csrf=${config.cookie.bili_jct}`,
			headers: {
				...baseHeaders,
				'Referer': 'https://big.bilibili.com/mobile/bigPoint/task',
			},
			body: { t: startTime, device: "phone", ts: $.getTimestamp() }
		}
		return await $.fetch(myRequest).then(response => {
			try {
				const body = $.toObj(response.body)
				if (body?.code === 0 && body?.message === "success") {
					$.log("⭕ 签到成功")
					return true
				} else {
					$.log("❌ 签到失败，" + body?.message)
					return false
				}
			} catch (e) {
				$.logErr(e, response)
			}
		})
	} else {
		$.log("⭕ 今日已完成")
	}
}

async function vipExtraExStatus() {
	const myRequest = {
		url: `https://api.bilibili.com/x/vip/web/vip_center/v2?csrf=${config.cookie.bili_jct}&access_key=${config.key}&appkey=27eb53fc9058f8c3&statistics=%7B%22appId%22%3A1%2C%22version%22%3A%228.44.0%22%2C%22abtest%22%3A%22%22%2C%22platform%22%3A1%7D`,
		headers: {
			...baseHeaders
		}
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0) {
				return body.data.experience
			} else {
				return 0
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function vipExtraEx() {
	const body = {
		csrf: config.cookie.bili_jct,
		ts: $.getTimestamp(),
		buvid: config.cookie.Buvid,
		mobi_app: 'iphone',
		platform: 'ios',
		appkey: '27eb53fc9058f8c3',
		access_key: config.key
	}
	body.sign = generateSign(body)
	const myRequest = {
		url: "https://api.bilibili.com/x/vip/experience/add",
		headers: {
			'accept': 'application/json, text/plain, */*',
			'app-key': 'iphone'
		},
		body: $.queryStr(body)
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "0") {
				$.log("⭕ 每日额外经验 (+10经验)")
				return true
			} else {
				$.log("❌ 每日额外经验任务失败，" + body?.message)
				return false
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreSignStatus() {
	const myRequest = {
		url: `https://api.bilibili.com/x/vip/vip_center/sign_in/three_days_sign?csrf=${config.cookie.bili_jct}&access_key=${config.key}&appkey=27eb53fc9058f8c3&statistics=%7B%22appId%22%3A1%2C%22version%22%3A%228.44.0%22%2C%22abtest%22%3A%22%22%2C%22platform%22%3A1%7D`,
		headers: {
			...baseHeaders
		}
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "0") {
				return body.data
			} else {
				return 0
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreStatus() {
	const myRequest = {
		url: `https://api.bilibili.com/x/vip_point/task/combine?csrf=${config.cookie.bili_jct}&build=84400100&mobi_app=iphone&access_key=${config.key}&appkey=27eb53fc9058f8c3&statistics=%7B%22appId%22%3A1%2C%22version%22%3A%228.44.0%22%2C%22abtest%22%3A%22%22%2C%22platform%22%3A1%7D`,
		headers: {
			...baseHeaders
		}
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0) {
				return body.data
			} else {
				return 0
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreVipMallView() {
	const myRequest = {
		url: "https://show.bilibili.com/api/activity/fire/common/event/dispatch",
		headers: {
			...baseHeaders,
			'Content-Type' : 'application/json',
		},
		body: `{"eventId":"hevent_oy4b7h3epeb"}`
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "SUCCESS") {
				return true
			} else {
				$.log("❌ 浏览会员购任务失败，" + body?.message)
				return false
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreAnimateTab() {
	const myRequest = {
		url: `https://api.bilibili.com/pgc/activity/deliver/task/complete?access_key=${config.key}&appkey=27eb53fc9058f8c3&position=jp_channel&statistics=%7B%22appId%22%3A1%2C%22version%22%3A%228.44.0%22%2C%22abtest%22%3A%22%22%2C%22platform%22%3A1%7D`,
		method: "POST",
		headers: {}
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "success") {
				return true
			} else {
				$.log("❌ 浏览追番频道任务失败，" + body?.message)
				return false
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreFilmTab() {
	const myRequest = {
		url: `https://api.bilibili.com/pgc/activity/deliver/task/complete?access_key=${config.key}&appkey=27eb53fc9058f8c3&position=tv_channel&statistics=%7B%22appId%22%3A1%2C%22version%22%3A%228.44.0%22%2C%22abtest%22%3A%22%22%2C%22platform%22%3A1%7D`,
		method: "POST",
		headers: {}
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "success") {
				return true
			} else {
				$.log("❌ 浏览影视频道任务失败，" + body?.message)
				return false
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreDressView() {
	const body = {
		csrf: config.cookie.bili_jct,
		ts: $.getTimestamp(),
		taskCode: 'dress-view',
		statistics: '%7B%22appId%22%3A1%2C%22version%22%3A%228.44.0%22%2C%22abtest%22%3A%22%22%2C%22platform%22%3A1%7D',
		appkey: '27eb53fc9058f8c3',
		access_key: config.key
	}
	const myRequest = {
		url: 'https://api.bilibili.com/pgc/activity/score/task/complete/v2',
		headers: {},
		body: $.queryStr(body)
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "success") {
				return true
			} else {
				$.log("❌ 浏览装扮商城主页任务失败")
				return false
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreOgvWatchNew() {
	const body = {
		csrf: config.cookie.bili_jct,
		ts: $.getTimestamp(),
		taskCode: 'ogvwatchnew',
		mobi_app: 'iphone',
		platform: 'ios',
		appkey: '27eb53fc9058f8c3',
		access_key: config.key
	}
	body.sign = generateSign(body)
	const myRequest = {
		url: 'https://api.bilibili.com/pgc/activity/score/task/receive/v2',
		headers: {
			...baseHeaders,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Referer': 'https://big.bilibili.com/mobile/bigPoint/task'
		},
		body: $.queryStr(body)
	}
	return await $.fetch(myRequest).then(async response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "success") {
				if (config.task_id && config.token) {
					await bigScoreOgvWatchComplete(config.task_id, config.token)
					delete config.task_id, delete config.token
					$.setItem($.name + "_daily_bonus", $.toStr(config))
					return true
				}
				delete config.task_id, delete config.token
				const bangumi = await getBangumi()
				const episode = bangumi.episodes[Math.floor(Math.random() * bangumi.episodes.length)]
				if (bangumi) {
					const { task_id, token } = await bigScoreOgvWatchMaterial(bangumi.season_id, episode.ep_id) || {}
					Object.assign(config, { task_id, token })
				} else {
					$.log("❌ 获取剧集明细失败")
				}
				$.setItem($.name + "_daily_bonus", $.toStr(config))
			} else {
				$.log("❌ 大会员观看剧集任务接取失败，" + body?.message)
			}
			return false
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreOgvWatchMaterial(season_id, epid) {
	const myRequest = {
		url: `https://api.bilibili.com/pgc/activity/deliver/material/receive?access_key=${config.key}&appkey=27eb53fc9058f8c3&build=84400100&ep_id=${epid}&mobi_app=iphone&season_id=${season_id}`,
		headers: {
			...baseHeaders,
			'Content-Type': 'application/json',
			'Referer': 'https://big.bilibili.com/mobile/bigPoint/task'
		},
		method: "POST"
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "success") {
				$.log("⏳ 任务计时开始,等待十分钟")
				return body.data.watch_count_down_cfg
			} else {
				$.log("❌ 任务计时失败，" + body?.message)
				return 0
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function bigScoreOgvWatchComplete(task_id, token) {
	const timestamp =($.startTime / 1000 + (Math.floor(Math.random() * 900) + 100) / 1000000).toFixed(6)
	const task_sign = md5(`${timestamp}#df2a46fd53&${token}`).toUpperCase()
	const myRequest = {
		url: `https://api.bilibili.com/pgc/activity/deliver/task/complete?access_key=${config.key}&appkey=27eb53fc9058f8c3&task_id=${task_id}&task_sign=${task_sign}&timestamp=${timestamp}&token=${token}`,
		method: "POST",
		headers: {}
	}
	await $.fetch(myRequest).then(async response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "success") {
				$.log("⭕ 大会员观看剧集任务完成")
			} else {
				$.log("❌ 大会员观看剧集任务失败，" + body?.message)
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function getBangumi() {
	const myRequest = {
		url: 'https://api.bilibili.com/pgc/view/web/season?season_id=33378'
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0 && body?.message === "success") {
				return body.result
			} else {
				return 0
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function vipPrivilege(type) {
	const body = {
		csrf: config.cookie.bili_jct,
		type
	}
	const myRequest = {
		url: 'https://api.bilibili.com/x/vip/privilege/receive',
		headers: {
			'Cookie': config.cookieStr
		},
		body: $.queryStr(body)
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0) {
				return true
			} else {
				if (body?.message === "你已领取过该权益" || body?.message.includes("已领取")) {
					if (type === 1 || type === 6) {
						$.log("🎁 当月各项大会员福利已领取，不再重复通知")
					}
				} else {
					$.log(`- 领取福利(类型:${type})失败，` + body?.message)
					if (type === 1) {
						$.msg("年度大会员月度福利", "B币券领取失败", "，" + body?.message)
					}
				}
				return false
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function Charge(mid, bp_num) {
	$.log("\n---- ⚡B币券自动充电 ----")
    let chargeMessage = ''; 
	const body = {
		bp_num,
		is_bp_remains_prior: true,
		up_mid: mid,
		otype: 'up',
		oid: mid,
		csrf: config.cookie.bili_jct
	}
	const myRequest = {
		url: 'https://api.bilibili.com/x/ugcpay/web/v2/trade/elec/pay/quick',
		headers: {
			...baseHeaders
		},
		body: $.queryStr(body)
	}
	await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0) {
				if (body?.data?.status === 4) {
                    let targetName = (mid == config.user.mid) ? config.user.uname : mid;
					$.log(`⭕ 为[${targetName}]充电成功`)
                    chargeMessage = `为[${targetName}]充电成功 ⭕\n`; 
				} else if (body?.data?.status === -4) {
					$.log("❌ 充电失败, B币不足")
                    chargeMessage = `自动充电: B币不足 ❌\n`; 
				} else {
					$.log("❌ 充电失败，" + body?.message)
                    chargeMessage = `自动充电: ${body.message} ❌\n`; 
				}
			} else {
				$.log("❌ 充电失败，" + body?.message)
                chargeMessage = `自动充电: ${body.message} ❌\n`; 
			}
		} catch (e) {
			$.logErr(e, response)
            chargeMessage = `自动充电: 执行异常 ❌\n`; 
		}
	})
    return chargeMessage; 
}

async function me() {
	const myRequest = {
		url: 'https://api.bilibili.com/x/web-interface/nav',
		headers: {
			...baseHeaders
		}
	}
	return await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code) {
				$.log("\n---- 👤 用户信息 ----\n")
				$.log("❌ 获取用户信息失败(请更新cookie)")
				$.setItem($.name + "_daily_bonus", (config = config?.Settings && Object.keys(config.Settings).length ? { Settings: config.Settings } : null) && $.toStr(config))
				return false
			} else {
				$.log("\n🍪 Cookie有效 ⭕\n")
				$.log("---- 👤 用户信息 ----\n")
				config.user = body?.data
				config.user.num = check("user") ? 1 : (config.user.num || 0) + 1
				$.setItem($.name + "_daily_bonus", $.toStr(config))

				config.user.mext_exp = config.user.level_info.next_exp - config.user.level_info.current_exp
				config.user.next_day = Math.ceil(config.user.mext_exp / 15)
				config.user.v6_exp = 28800 - config.user.level_info.current_exp
				config.user.v6_day = Math.ceil(config.user.v6_exp / 15)

				if (config.user.vipStatus === 1) {
    				$.log("🫅 尊贵的" + config.user.vip_label.text + "「" + config.user.uname + "」")
					$.log("🪪 ID: " + config.user.mid)
    				$.log("👑 大会员有效期至：" + format(config.user.vipDueDate, 'yyyy-MM-dd'))
				}
				$.log("🪙 硬币: " + Math.floor(config.user.money))
				$.log("💴 B币: " + config.user.wallet.bcoin_balance)
				$.log("📈 等级: Lv " + config.user.level_info.current_level)

				if (config.user.level_info.current_level < 6) {
				$.log(`- 当前经验: ${config.user.level_info.current_exp}/${config.user.level_info.next_exp}`)
				$.log(`- 升级还需经验: ${config.user.mext_exp}`)
				$.log(`- 距离下级还需: ${config.user.next_day}天(登录 观看 分享)`)
				$.log(`- 距离满级还需: ${Math.max(0, config.user.v6_day)}天(登录 观看 分享)`)
				} else {
					$.log(`⭐ 当前经验: ${config.user.level_info.current_exp} (已满级)`)
				}

				$.log(`💰 剩余硬币最多可投: ${Math.floor((config.user.money)/5)}天`)

				if (config.user.level_info.current_level < 6) {
					$.log("⭐ 距离满级最快还需: " + Math.max(0, Math.ceil(config.user.v6_exp / 65)) + "天(日常 + 投币*5)")
				}

				return true
			}
		} catch (e) {
			$.logErr(e, response)
		}
	}, reason => {
		$.msg($.name, "❌ 获取用户信息失败", $.toStr(reason))
		return false
})

}

async function queryStatus(exec_times) {
	const myRequest = {
			url: "https://api.bilibili.com/x/member/web/exp/reward",
			headers: {
				...baseHeaders
			}
	}
	await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.code === 0) {
				const data = body.data;
				
				// 核心修改：判断是否为今日首次打卡（各项任务均为初始状态）
				const isFirstRun = !data.login && !data.watch && !data.share && data.coins === 0;

				if (isFirstRun) {
					$.log("\n---- 📝 任务已开始 ----\n");
					config.user.num = 0;
					config.watch.num = 0;
					config.share.num = 0;
				} else {
					$.log("\n---- 📝 任务进度 ----\n");
					if (data.login) {
						$.log("⭕ 今日已登录")
						config.user.num = config.user?.num || 1
						if (!config['user'].hasOwnProperty("time")) config.user.time = startTime
					} else {
						$.log("❕ 今日尚未登录")
						config.user.num = 0
					}
					if (data.watch){
						$.log("⭕ 今日已观看")
						config.watch.num = config.watch?.num || 1
						if (!config['watch'].hasOwnProperty("time")) config.watch.time = startTime
					} else {
						$.log("❕ 今日尚未观看")
						config.watch.num = 0
					}
					if (data.share){
						$.log("⭕ 今日已分享")
						config.share.num = config.share?.num || 1
						if (!config['share'].hasOwnProperty("time")) config.share.time = startTime
					} else {
						$.log("❕ 今日尚未分享")
						config.share.num = 0
					}
					if (data.coins === 50){
						$.log("⭕ 今日已投币")
						if (!config['coins'].hasOwnProperty("time")) config.coins.time = startTime
					} else if ((data.coins / 10) >= exec_times) {
						if (!config['coins'].hasOwnProperty("time")) config.coins.time = startTime
						$.log(`⭕ 今日已投币（达到设定数量: ${exec_times}）`)
					} else if (config.user.money <= 5) {
						$.log("❕ 硬币数不足")
					} else {
						$.log("❕ 今日投币未完成")
					}
				}
				
				config.coins.num = data.coins
				$.setItem($.name + "_daily_bonus", $.toStr(config))
			} else {
				$.log("❌ 查询失败，" + body?.message)
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

async function dynamic() {
	const myRequest = {
		url: `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/dynamic_new?uid=${config.cookie.DedeUserID}&type_list=8&from=&platform=web`,
		headers: {
			...baseHeaders
		}
	}
	await $.fetch(myRequest).then(response => {
		try {
			const body = $.toObj(response.body)
			if (body?.data?.cards) {
				cards = body.data.cards
				const { user, watch, share } = config
				user.time = watch.time = share.time = startTime
			}
		} catch (e) {
			$.logErr(e, response)
		}
	})
}

// Wbi签名获取
function getWbiSigns(r){function t(r){let t="";return e.forEach(s=>{t+=r[s]}),t.slice(0,32)}function s(r,s,u){const e=t(s+u),i=parseInt($.startTime/1e3);let n="";r=Object.assign(r,{wts:i}),n=$.queryStr(Object.fromEntries(new Map(Array.from(Object.entries(r)).sort())));const l=md5(n+e);return n+"&w_rid="+l}function u(){return img_url=config.user.wbi_img.img_url,sub_url=config.user.wbi_img.sub_url,{img_key:img_url.substring(img_url.lastIndexOf("/")+1,img_url.length).split(".")[0],sub_key:sub_url.substring(sub_url.lastIndexOf("/")+1,sub_url.length).split(".")[0]}}const e=[46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52],i=u();return s(r,i.img_key,i.sub_key)}

// md5(32位)
function md5(r){function n(r,n){return r<<n|r>>>32-n}function t(r,n){var t,o,e,u,f;return e=2147483648&r,u=2147483648&n,t=1073741824&r,o=1073741824&n,f=(1073741823&r)+(1073741823&n),t&o?2147483648^f^e^u:t|o?1073741824&f?3221225472^f^e^u:1073741824^f^e^u:f^e^u}function o(r,n,t){return r&n|~r&t}function e(r,n,t){return r&t|n&~t}function u(r,n,t){return r^n^t}function f(r,n,t){return n^(r|~t)}function i(r,e,u,f,i,a,c){return r=t(r,t(t(o(e,u,f),i),c)),t(n(r,a),e)}function a(r,o,u,f,i,a,c){return r=t(r,t(t(e(o,u,f),i),c)),t(n(r,a),o)}function c(r,o,e,f,i,a,c){return r=t(r,t(t(u(o,e,f),i),c)),t(n(r,a),o)}function C(r,o,e,u,i,a,c){return r=t(r,t(t(f(o,e,u),i),c)),t(n(r,a),o)}function g(r){for(var n,t=r.length,o=t+8,e=(o-o%64)/64,u=16*(e+1),f=Array(u-1),i=0,a=0;a<t;)n=(a-a%4)/4,i=a%4*8,f[n]=f[n]|r.charCodeAt(a)<<i,a++;return n=(a-a%4)/4,i=a%4*8,f[n]=f[n]|128<<i,f[u-2]=t<<3,f[u-1]=t>>>29,f}function h(r){var n,t,o="",e="";for(t=0;t<=3;t++)n=r>>>8*t&255,e="0"+n.toString(16),o+=e.slice(-2);return o}function d(r){r=r.replace(/\r\n/g,"\n");for(var n="",t=0;t<r.length;t++){var o=r.charCodeAt(t);o<128?n+=String.fromCharCode(o):o>127&&o<2048?(n+=String.fromCharCode(o>>6|192),n+=String.fromCharCode(63&o|128)):(n+=String.fromCharCode(o>>12|224),n+=String.fromCharCode(o>>6&63|128),n+=String.fromCharCode(63&o|128))}return n}var m,S,v,l,A,s,y,p,w,L=Array(),b=7,j=12,k=17,q=22,x=5,z=9,B=14,D=20,E=4,F=11,G=16,H=23,I=6,J=10,K=15,M=21;for(r=d(r),L=g(r),s=1732584193,y=4023233417,p=2562383102,w=271733878,m=0;m<L.length;m+=16)S=s,v=y,l=p,A=w,s=i(s,y,p,w,L[m+0],b,3614090360),w=i(w,s,y,p,L[m+1],j,3905402710),p=i(p,w,s,y,L[m+2],k,606105819),y=i(y,p,w,s,L[m+3],q,3250441966),s=i(s,y,p,w,L[m+4],b,4118548399),w=i(w,s,y,p,L[m+5],j,1200080426),p=i(p,w,s,y,L[m+6],k,2821735955),y=i(y,p,w,s,L[m+7],q,4249261313),s=i(s,y,p,w,L[m+8],b,1770035416),w=i(w,s,y,p,L[m+9],j,2336552879),p=i(p,w,s,y,L[m+10],k,4294925233),y=i(y,p,w,s,L[m+11],q,2304563134),s=i(s,y,p,w,L[m+12],b,1804603682),w=i(w,s,y,p,L[m+13],j,4254626195),p=i(p,w,s,y,L[m+14],k,2792965006),y=i(y,p,w,s,L[m+15],q,1236535329),s=a(s,y,p,w,L[m+1],x,4129170786),w=a(w,s,y,p,L[m+6],z,3225465664),p=a(p,w,s,y,L[m+11],B,643717713),y=a(y,p,w,s,L[m+0],D,3921069994),s=a(s,y,p,w,L[m+5],x,3593408605),w=a(w,s,y,p,L[m+10],z,38016083),p=a(p,w,s,y,L[m+15],B,3634488961),y=a(y,p,w,s,L[m+4],D,3889429448),s=a(s,y,p,w,L[m+9],x,568446438),w=a(w,s,y,p,L[m+14],z,3275163606),p=a(p,w,s,y,L[m+3],B,4107603335),y=a(y,p,w,s,L[m+8],D,1163531501),s=a(s,y,p,w,L[m+13],x,2850285829),w=a(w,s,y,p,L[m+2],z,4243563512),p=a(p,w,s,y,L[m+7],B,1735328473),y=a(y,p,w,s,L[m+12],D,2368359562),s=c(s,y,p,w,L[m+5],E,4294588738),w=c(w,s,y,p,L[m+8],F,2272392833),p=c(p,w,s,y,L[m+11],G,1839030562),y=c(y,p,w,s,L[m+14],H,4259657740),s=c(s,y,p,w,L[m+1],E,2763975236),w=c(w,s,y,p,L[m+4],F,1272893353),p=c(p,w,s,y,L[m+7],G,4139469664),y=c(y,p,w,s,L[m+10],H,3200236656),s=c(s,y,p,w,L[m+13],E,681279174),w=c(w,s,y,p,L[m+0],F,3936430074),p=c(p,w,s,y,L[m+3],G,3572445317),y=c(y,p,w,s,L[m+6],H,76029189),s=c(s,y,p,w,L[m+9],E,3654602809),w=c(w,s,y,p,L[m+12],F,3873151461),p=c(p,w,s,y,L[m+15],G,530742520),y=c(y,p,w,s,L[m+2],H,3299628645),s=C(s,y,p,w,L[m+0],I,4096336452),w=C(w,s,y,p,L[m+7],J,1126891415),p=C(p,w,s,y,L[m+14],K,2878612391),y=C(y,p,w,s,L[m+5],M,4237533241),s=C(s,y,p,w,L[m+12],I,1700485571),w=C(w,s,y,p,L[m+3],J,2399980690),p=C(p,w,s,y,L[m+10],K,4293915773),y=C(y,p,w,s,L[m+1],M,2240044497),s=C(s,y,p,w,L[m+8],I,1873313359),w=C(w,s,y,p,L[m+15],J,4264355552),p=C(p,w,s,y,L[m+6],K,2734768916),y=C(y,p,w,s,L[m+13],M,1309151649),s=C(s,y,p,w,L[m+4],I,4149444226),w=C(w,s,y,p,L[m+11],J,3174756917),p=C(p,w,s,y,L[m+2],K,718787259),y=C(y,p,w,s,L[m+9],M,3951481745),s=t(s,S),y=t(y,v),p=t(p,l),w=t(w,A);return(h(s)+h(y)+h(p)+h(w)).toLowerCase()}

/***************** Env *****************/
// prettier-ignore
// https://github.com/chavyleung/scripts/blob/master/Env.min.js

function Env(e,t){return new class{constructor(e,t){this.name=e,this.version="1.7.5",this.data=null,this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,t),this.log("",`🔔${this.name}, 开始!`)}platform(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":"undefined"!=typeof Egern?"Egern":void 0}isQuanX(){return"Quantumult X"===this.platform()}isSurge(){return"Surge"===this.platform()}isLoon(){return"Loon"===this.platform()}isShadowrocket(){return"Shadowrocket"===this.platform()}isStash(){return"Stash"===this.platform()}isEgern(){return"Egern"===this.platform()}toObj(e,t=null){try{return JSON.parse(e)}catch{return t}}toStr(e,t=null){try{return JSON.stringify(e)}catch{return t}}lodash_get(e={},t="",s){Array.isArray(t)||(t=this.toPath(t));const a=t.reduce(((e,t)=>Object(e)[t]),e);return void 0===a?s:a}lodash_set(e={},t="",s){return Array.isArray(t)||(t=this.toPath(t)),t.slice(0,-1).reduce(((e,s,a)=>Object(e[s])===e[s]?e[s]:e[s]=/^\d+$/.test(t[a+1])?[]:{}),e)[t[t.length-1]]=s,e}toPath(e){return e.replace(/\[(\d+)\]/g,".$1").split(".").filter(Boolean)}getItem(e=new String,t=null){let s=t;switch(e.startsWith("@")){case!0:const{key:t,path:a}=e.match(/^@(?<key>[^.]+)(?:\.(?<path>.*))?$/)?.groups;e=t;let o=this.getItem(e,{});"object"!=typeof o&&(o={}),s=this.lodash_get(o,a);try{s=JSON.parse(s)}catch(e){}break;default:switch(this.platform()){case"Surge":case"Loon":case"Stash":case"Egern":case"Shadowrocket":s=$persistentStore.read(e);break;case"Quantumult X":s=$prefs.valueForKey(e);break;default:s=this.data?.[e]||null;break}try{s=JSON.parse(s)}catch(e){}break}return s??t}setItem(e=new String,t=new String){let s=!1;switch(typeof t){case"object":t=JSON.stringify(t);break;default:t=String(t);break}switch(e.startsWith("@")){case!0:const{key:a,path:o}=e.match(/^@(?<key>[^.]+)(?:\.(?<path>.*))?$/)?.groups;e=a;let r=this.getItem(e,{});"object"!=typeof r&&(r={}),this.lodash_set(r,o,t),s=this.setItem(e,r);break;default:switch(this.platform()){case"Surge":case"Loon":case"Stash":case"Egern":case"Shadowrocket":s=$persistentStore.write(t,e);break;case"Quantumult X":s=$prefs.setValueForKey(t,e);break;default:s=this.data?.[e]||null;break}break}return s}async fetch(e={}||"",t={}){switch(e.constructor){case Object:e={...e,...t};break;case String:e={url:e,...t};break}e.method||(e.method=e.body??e.bodyBytes?"POST":"GET"),e.headers?.Host,e.headers?.[":authority"],e.headers?.["Content-Length"],e.headers?.["content-length"];const s=e.method.toLocaleLowerCase();switch(this.platform()){case"Loon":case"Surge":case"Stash":case"Egern":case"Shadowrocket":default:return e.policy&&(this.isLoon()&&(e.node=e.policy),this.isStash()&&this.lodash_set(e,"headers.X-Stash-Selected-Proxy",encodeURI(e.policy))),e.followRedirect&&((this.isSurge()||this.isLoon())&&(e["auto-redirect"]=!1),this.isQuanX()&&(e.opts?e.opts.redirection=!1:e.opts={redirection:!1})),e.bodyBytes&&!e.body&&(e.body=e.bodyBytes,delete e.bodyBytes),await new Promise(((t,a)=>{$httpClient[s](e,((s,o,r)=>{s?a(s):(o.ok=/^2\d\d$/.test(o.status),o.statusCode=o.status,r&&(o.body=r,1==e["binary-mode"]&&(o.bodyBytes=r)),t(o))}))}));case"Quantumult X":return e.policy&&this.lodash_set(e,"opts.policy",e.policy),"boolean"==typeof e["auto-redirect"]&&this.lodash_set(e,"opts.redirection",e["auto-redirect"]),e.body instanceof ArrayBuffer?(e.bodyBytes=e.body,delete e.body):ArrayBuffer.isView(e.body)?(e.bodyBytes=e.body.buffer.slice(e.body.byteOffset,e.body.byteLength+e.body.byteOffset),delete object.body):e.body&&delete e.bodyBytes,await $task.fetch(e).then((e=>(e.ok=/^2\d\d$/.test(e.statusCode),e.status=e.statusCode,e)),(e=>Promise.reject(e.error)))}}time(e,t=null){const s=t?new Date(t):new Date;let a={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(e)&&(e=e.replace(RegExp.$1,(s.getFullYear()+"").slice(4-RegExp.$1.length)));for(let t in a)new RegExp("("+t+")").test(e)&&(e=e.replace(RegExp.$1,1==RegExp.$1.length?a[t]:("00"+a[t]).slice((""+a[t]).length)));return e}getBaseURL(e){return e.replace(/[?#].*$/,"")}isAbsoluteURL(e){return/^[a-z][a-z0-9+.-]*:/.test(e)}getURLParameters(e){return(e.match(/([^?=&]+)(=([^&]*))/g)||[]).reduce(((e,t)=>(e[t.slice(0,t.indexOf("="))]=t.slice(t.indexOf("=")+1),e)),{})}getTimestamp(e=new Date){return Math.floor(e.getTime()/1e3)}queryStr(e){let t=[];for(let s in e)e.hasOwnProperty(s)&&t.push(`${s}=${e[s]}`);return t.join("&")}queryObj(e){let t={},s=e.split("&");for(let e of s){let s=e.split("="),a=s[0],o=s[1]||"";a&&(t[a]=o)}return t}msg(e=this.name,t="",s="",a={}){const o=e=>{const{$open:t,$copy:s,$media:a,$mediaMime:o}=e;switch(typeof e){case void 0:return e;case"string":switch(this.platform()){case"Surge":case"Stash":case"Egern":default:return{url:e};case"Loon":case"Shadowrocket":return e;case"Quantumult X":return{"open-url":e}}case"object":switch(this.platform()){case"Surge":case"Stash":case"Egern":case"Shadowrocket":default:{const r={};let i=e.openUrl||e.url||e["open-url"]||t;i&&Object.assign(r,{action:"open-url",url:i});let n=e["update-pasteboard"]||e.updatePasteboard||s;n&&Object.assign(r,{action:"clipboard",text:n});let l=e.mediaUrl||e["media-url"]||a;if(l){let e,t;if(l.startsWith("http"));else if(l.startsWith("data:")){const[s]=l.split(";"),[,a]=l.split(",");e=a,t=s.replace("data:","")}else{e=l,t=(e=>{const t={JVBERi0:"application/pdf",R0lGODdh:"image/gif",R0lGODlh:"image/gif",iVBORw0KGgo:"image/png","/9j/":"image/jpg"};for(var s in t)if(0===e.indexOf(s))return t[s];return null})(l)}Object.assign(r,{"media-url":l,"media-base64":e,"media-base64-mime":o??t})}return Object.assign(r,{"auto-dismiss":e["auto-dismiss"],sound:e.sound}),r}case"Loon":{const o={};let r=e.openUrl||e.url||e["open-url"]||t;r&&Object.assign(o,{openUrl:r});let i=e.mediaUrl||e["media-url"]||a;i&&Object.assign(o,{mediaUrl:i});let n=e["update-pasteboard"]||e.updatePasteboard||s;return n&&Object.assign(o,{clipboard:n}),o}case"Quantumult X":{const o={};let r=e["open-url"]||e.url||e.openUrl||t;r&&Object.assign(o,{"open-url":r});let i=e.mediaUrl||e["media-url"]||a;i&&Object.assign(o,{"media-url":i});let n=e["update-pasteboard"]||e.updatePasteboard||s;return n&&Object.assign(o,{"update-pasteboard":n}),o}}default:return}};if(!this.isMute)switch(this.platform()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(e,t,s,o(a));break;case"Quantumult X":$notify(e,t,s,o(a));break}}log(...e){e.length>0&&(this.logs=[...this.logs,...e]),console.log(e.join(this.logSeparator))}logErr(e,t){switch(this.platform()){case"Surge":case"Loon":case"Stash":case"Egern":case"Shadowrocket":case"Quantumult X":default:this.log("",`❗️${this.name}, 错误!`,e,t);break}}wait(e){return new Promise((t=>setTimeout(t,e)))}done(e={}){const t=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${t} 秒`),this.platform()){case"Surge":e.policy&&this.lodash_set(e,"headers.X-Surge-Policy",e.policy),$done(e);break;case"Loon":e.policy&&(e.node=e.policy),$done(e);break;case"Stash":e.policy&&this.lodash_set(e,"headers.X-Stash-Selected-Proxy",encodeURI(e.policy)),$done(e);break;case"Egern":$done(e);break;case"Shadowrocket":default:$done(e);break;case"Quantumult X":e.policy&&this.lodash_set(e,"opts.policy",e.policy),delete e["auto-redirect"],delete e["auto-cookie"],delete e["binary-mode"],delete e.charset,delete e.host,delete e.insecure,delete e.method,delete e.opt,delete e.path,delete e.policy,delete e["policy-descriptor"],delete e.scheme,delete e.sessionIndex,delete e.statusCode,delete e.timeout,e.body instanceof ArrayBuffer?(e.bodyBytes=e.body,delete e.body):ArrayBuffer.isView(e.body)?(e.bodyBytes=e.body.buffer.slice(e.body.byteOffset,e.body.byteLength+e.body.byteOffset),delete e.body):e.body&&delete e.bodyBytes,$done(e);break}}}(e,t)}

---
title: 古风壁纸+我计划做个自动出图的定时任务
slug: guzhuang-wallpapers-scheduled-generation-20261114
date: 2026-11-14T22:44:18+08:00
category: 技术/AI
tags: [ComfyUI, AI 绘画, 古风壁纸]
kind: photo
summary: 一组本地模型生成的古风壁纸，以及把主题、提示词、ComfyUI 工作流和定时出图串起来的计划。
draft: false
images:
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/01.png
    alt: 杏花树下的古装女子轻扶花枝，身后是庭院回廊
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/02.png
    alt: 青衣女子撑着纸伞走过烟雨中的石桥
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/03.png
    alt: 湖畔亭中，古装女子手持荷花团扇
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/04.png
    alt: 灯市中，红衣女子回眸，身旁挂着灯笼
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/05.png
    alt: 雪中庭院里，披红色斗篷的女子望向梅花
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/06.png
    alt: 竹林小径上，青衣女侠佩剑而行
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/07.png
    alt: 木窗旁，紫衣女子低头翻阅书卷
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/08.png
    alt: 春日庭院中，黄衣女子坐在秋千上
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/09.png
    alt: 廊下，古装女子将茶汤倒入白瓷杯
  - src: ./guzhuang-wallpapers-scheduled-generation-20261114/10.png
    alt: 月夜回廊里，白衣女子手持书卷仰望夜空
---

今天试了一下本地图片模型，用的是 ComfyUI + Krea 2。这次生成的图片，细节和质感还挺不错，有些地方比 ChatGPT 生成的更合我意。不过人物有点过于完美，看着不太像真人，后面再调整提示词。

我的想法是，提前选好每天的主题，比如古装人物、猫咪或者生活场景。到了凌晨 0 点，AI 根据主题生成 10 条不同画面的提示词，再通过 ComfyUI 的接口，把提示词交给配置好的工作流，由本地模型生成图片。如果当天没选主题，就让 AI 自己选一个。

今天测试时，连续出图让电脑热得挺明显。因为生成图片需要持续进行大量计算，模型本身也比较占内存。所以我把任务改成了：提示词准备好后立即生成第一张，之后每隔半小时生成一张，给电脑留点休息和散热的时间。如果上一张还没生成完，就跳过当前这一张，不继续排队。

最后在早上 6 点，把生成好的图片和对应提示词统一整理到一个目录里，失败的也记录一下原因。

这样早上起来，就能看看昨晚生成了些什么。

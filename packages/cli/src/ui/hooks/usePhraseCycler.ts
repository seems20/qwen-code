/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';

export const WITTY_LOADING_PHRASES = [
  '冬瓜、黄瓜、西瓜、南瓜都能吃，什么瓜不能吃？',
  '盆里有6只馒头，6个小朋友每人分到1只，但盆里还留着1只，为什么？',
  '你能以最快速度，把冰变成水吗？',
  '冬天，宝宝怕冷，到了屋里也不肯脱帽。可是他见了一个人乖乖地脱下帽，那人是谁？',
  '老王一天要刮四五十次脸，脸上却仍有胡子。这是什么原因？',
  '有一个字，人人见了都会念错。这是什么字？',
  '小华在家里，和谁长得最像？',
  '鸡蛋壳有什么用处？',
  '不必花力气打的东西是什么？',
  '你能做，我能做，大家都做；一个人能做，两个人不能一起做。这是做什么？',
  '什么事每人每天都必须认真做？',
  '什么人始终不敢洗澡？',
  '小明从不念书却得了模范生，为什么？',
  '什么车子寸步难行？',
  '哪一个月有二十八天？',
  '你知道上课睡觉有什么不好吗？',
  '什么酒不能喝？',
  '什么蛋打不烂，煮不熟，更不能吃？',
  '打什么东西，不必花力气？',
  '火车由北京到上海需要6小时，行使3小时后，火车该在什么地方？',
  '时钟什么时候不会走？',
  '书店里买不到什么书？',
  '什么路最窄？',
  '什么东西不能吃？',
  '一个人从飞机上掉下来，为什么没摔死呢？',
  '一年四季都盛开的花是什么花？',
  '什么英文字母最多人喜欢听？',
  '什么人生病从来不看医生？',
  '小明知道试卷的答案，为什么还频频看同学的？',
  '用铁锤锤鸡蛋为什么锤不破？',
  '拳击冠军很容易被谁击倒？',
  '什么事天不知地知，你不知我知？',
  '一个人在沙滩上行走，但在他的身后却没有发现脚印，为什么？',
  '一位卡车司机撞倒一个骑摩托车的人，卡车司机受重伤，摩托车骑士却没事，为什么？',
  '早晨醒来，每个人都要做的第一件事是什么？',
  '你能用蓝笔写出红字来吗？',
  '汽车在右转弯时，哪只轮胎不转？',
  '孔子与孟子有什么区别？',
  '为什么小王从初一到初三就学了一篇课文？',
  '一个人空肚子最多能吃几个鸡蛋？',
  '当哥伦布一只脚迈上新大陆后，紧接着做什么？',
  '毛毛虫回到家，对爸爸说了一句话，爸爸当场晕倒，毛毛虫说了什么话？',
  '飞机从天上掉下来，为什么没有一个受伤的？',
  '太平洋的中间是什么？',
  '世界上最小的岛是什么？',
  '把一只鸡和一只鹅同时放在冰箱里，为什么鸡死了鹅没死？',
  '四个人在一间小屋里打麻将（没有其他人在看着），这时警察来了，四个人都跑了，可是警察到了屋里又抓到一个人，为什么？',
  '万兽大王是谁？',
  '用什么可以解开所有的谜？',
  '什么样的人死后还会出现？',
  '专爱打听别人事的人是谁？',
  '谁说话的声音传得最远？',
  '什么东西的制造日期和有效期是同一天？',
  '小咪昨晚花了整整一个晚上在历史课本上，可第二天妈妈还是骂她不用功，为什么？',
  '能否用树叶遮住天空？',
  '一头牛，向北走10米，再向西走10米，再向南走10米，倒退右转，问牛的尾巴朝哪儿？',
  '为什么黑人喜欢吃白色巧克力？',
  '把8分成两半，是多少？',
  '口吃的人最吃亏的是？',
  '什么东西使人哭笑不得？',
  '身份证掉了怎么办？',
  '有个人走独木桥，前面来了一只老虎，后面来了只熊，这个人是怎么过去的？',
  '监狱里关着两名犯人，一天晚上犯人都逃跑了，可是第二天看守员打开牢门一看，里面还有一个犯人？',
  '小明的妈妈有三个儿子，大儿子叫大明，二儿子叫二明，三儿子叫什么？',
  '猫见了老鼠为什么拔腿就跑？',
  '大象的左边耳朵象什么？',
  '针掉到大海怎么办？',
  '有一个人走在沙滩上，回头却看不见自己的脚印，为什么？',
  '一只候鸟从南方飞到北方要用一个小时，而从北方飞到南方则需二个半小时，为什么呢？',
  '什么人骗别人也骗自己？',
  '李先生到16层楼去谈生意，但他只乘电梯到14层楼，然后再步行爬楼梯上去，为什么？',
  '一个小孩和一个大人在漆黑的夜晚走路，小孩是大人的儿子，大人却不是小孩的父亲，请问为什么？',
  '什么字全世界通用？',
  '一个人的前面放了一本又厚又宽的大书，他想跨过去可怎么也跨不过去，你知道这是什么原因吗？',
  '人的长寿秘诀是什么？',
  '什么时候看到的月亮最大？',
  '什么人一年中只工作一天？',
  '什么事睁一只眼闭一只眼比较好？',
  '为什么刚出生的小孩只有一只左眼睛？',
  '哪颗牙最后长出来？',
  '房间里着火了，小明怎么也拉不开门，请问他后来是怎么出去的？',
  '蓝兰并没生病，但她整个晚上嘴巴一张一合？',
  '什么最会弄虚做假？',
  '有两个面的盒子吗？',
  '铁放在屋外露天会生锈，那么金子呢？',
  '拿鸡蛋扔石头，为什么鸡蛋没破？',
  '"新华字典"有多少个字？',
  '超人和蝙蝠侠有什么不同？',
  '什么人心肠最不好？',
  '客人送来一篮草莓，贝贝吵着要吃草莓。可妈妈偏说家里没有草莓为什么？',
  '从来没见过的爷爷他是什么爷爷？',
  '2对父子去打猎，他们每人达了一只野鸭，但是总共却只有3只，为什么？',
  '一个病人到医院去做健康检查，为什么医生说："你离我远一点"请问这病人得了什么病？',
  '什么东西没吃的时候是绿的，吃的时候是红的，吐出来的是黑的？',
  '为什么太阳天天都比人起的早？',
  '一只狼钻进羊圈，想吃羊，可是它为啥没吃又没吃羊？',
  '有卖的，没买的，每天卖了不少的。',
  '什么船最安全？',
  '山坡上有一群羊，来了一群羊。一共有几群羊？',
];

export const PHRASE_CHANGE_INTERVAL_MS = 15000;

/**
 * Custom hook to manage cycling through loading phrases.
 * @param isActive Whether the phrase cycling should be active.
 * @param isWaiting Whether to show a specific waiting phrase.
 * @returns The current loading phrase.
 */
export const usePhraseCycler = (isActive: boolean, isWaiting: boolean) => {
  const [currentLoadingPhrase, setCurrentLoadingPhrase] = useState(
    WITTY_LOADING_PHRASES[0],
  );
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isWaiting) {
      setCurrentLoadingPhrase('Waiting for user confirmation...');
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    } else if (isActive) {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
      }
      // Select an initial random phrase
      const initialRandomIndex = Math.floor(
        Math.random() * WITTY_LOADING_PHRASES.length,
      );
      setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[initialRandomIndex]);

      phraseIntervalRef.current = setInterval(() => {
        // Select a new random phrase
        const randomIndex = Math.floor(
          Math.random() * WITTY_LOADING_PHRASES.length,
        );
        setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[randomIndex]);
      }, PHRASE_CHANGE_INTERVAL_MS);
    } else {
      // Idle or other states, clear the phrase interval
      // and reset to the first phrase for next active state.
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
      setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[0]);
    }

    return () => {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    };
  }, [isActive, isWaiting]);

  return currentLoadingPhrase;
};

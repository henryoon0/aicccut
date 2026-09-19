import type { VariantDef } from "#/prototypes/types";
import { Classic } from "./classic";
import { Bold } from "./bold";
import { Minimal } from "./minimal";
import { Magnetic } from "./magnetic";
import { Dense } from "./dense";

export const variants: VariantDef[] = [
  {
    name: "Classic",
    axis: "44px 트랙에 필름스트립·파형을 그리고, 헤더에 M/S/L·높이 토글까지 다 보여준다.",
    when: "Premiere·DaVinci에 익숙한 사람이 바로 손에 익어야 할 때.",
    cost: "처음 보는 사람에겐 정보가 많아 첫 인상이 무겁다.",
    component: Classic,
    hasMotion: false,
  },
  {
    name: "Bold",
    axis: "68px 트랙, 큰 라운드 클립과 종류별 강한 색, 타임코드 깃발이 달린 굵은 재생 헤드.",
    when: "소비자용 편집기처럼 한눈에 읽히는 타임라인을 원할 때.",
    cost: "세로 공간을 많이 먹어 트랙 6개면 이미 스크롤이 생긴다.",
    component: Bold,
    hasMotion: false,
  },
  {
    name: "Minimal",
    axis: "헤더는 36px 아이콘으로 접고(호버 시 펼침), 클립은 채우기 대신 테두리 막대, 눈금은 헤어라인.",
    when: "화면이 작거나 콘텐츠 자체가 주인공이어야 할 때.",
    cost: "뮤트·잠금 같은 상태를 한 번 더 호버해서 확인해야 한다.",
    component: Minimal,
    hasMotion: false,
  },
  {
    name: "Magnetic",
    axis: "메인 비디오 트랙 1개가 빈틈 없이 붙어 있고, 드래그하면 구멍 대신 순서가 바뀐다(CapCut·iMovie 방식).",
    when: "컷 순서 정리가 주 작업이고 빈 구간 실수를 막고 싶을 때.",
    cost: "의도적인 빈 구간이나 다중 비디오 레이어 편집은 어색해진다.",
    component: Magnetic,
    hasMotion: true,
  },
  {
    name: "Dense",
    axis: "28px 트랙, 프레임 단위 눈금, 마커 레인, 재생 중 오디오 미터, J/K/L 키보드 우선.",
    when: "긴 강의 영상을 프레임 단위로 다듬는 숙련 사용자를 위할 때.",
    cost: "글자가 작아 트랙패드·노트북 화면에서는 피로하다.",
    component: Dense,
    hasMotion: false,
  },
];

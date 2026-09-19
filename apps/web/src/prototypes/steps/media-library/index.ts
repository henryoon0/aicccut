import type { VariantDef } from "#/prototypes/types";
import { Grid } from "./grid";
import { List } from "./list";
import { Filmstrip } from "./filmstrip";
import { Bins } from "./bins";
import { Smart } from "./smart";

export const variants: VariantDef[] = [
  { name: "Grid", axis: "썸네일 격자, 메타 정보는 호버에서만 드러남", when: "영상·이미지가 많아 눈으로 훑어 고르는 편집일 때", cost: "이름·용량·추가일은 한눈에 비교하기 어려움", component: Grid, pickerPosition: "top" },
  { name: "List", axis: "촘촘한 표, 열 정렬과 다중 선택이 중심", when: "파일이 수십 개 넘고 이름·용량으로 관리해야 할 때", cost: "썸네일이 작아 내용을 눈으로 구분하기 어려움", component: List, pickerPosition: "top" },
  { name: "Filmstrip", axis: "가로 띠에서 호버 스크럽, 아래에 큰 미리보기", when: "클립 안의 장면을 확인하며 고르는 컷 편집일 때", cost: "한 화면에 보이는 개수가 적고 세로 공간을 많이 씀", component: Filmstrip, pickerPosition: "top" },
  { name: "Bins", axis: "폴더 트리로 자산을 분류, 폴더 사이 드래그로 정리", when: "촬영본·화면녹화·오디오가 섞인 긴 프로젝트일 때", cost: "분류하는 수고가 들고 폴더 패널이 폭을 차지함", component: Bins, pickerPosition: "top" },
  { name: "Smart", axis: "검색이 첫 화면, 메타에서 뽑은 자동 태그로 좁힘", when: "이름을 대충 기억하고 조건으로 찾는 습관일 때", cost: "훑어보기가 약하고 태그가 맞지 않으면 못 찾음", component: Smart, pickerPosition: "top" },
];

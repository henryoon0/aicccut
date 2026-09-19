import type { VariantDef } from "#/prototypes/types";
import { DialogVariant } from "./dialog";
import { PresetsVariant } from "./presets";
import { PanelVariant } from "./panel";
import { WizardVariant } from "./wizard";
import { MinimalVariant } from "./minimal";

export const variants: VariantDef[] = [
  {
    name: "Dialog",
    axis: "설정 폼과 실시간 요약 카드를 한 모달에 나란히 두고, 렌더링이 폼 자리를 대신한다.",
    when: "설정을 한눈에 다 보고 확인한 뒤 내보내는 익숙한 흐름이 필요할 때",
    cost: "모달이라 렌더링 중 편집기를 못 쓴다.",
    component: DialogVariant,
  },
  {
    name: "Presets",
    axis: "포맷보다 목적지(YouTube·Reels·Threads)부터 고르고, 진행률은 고른 카드 위 링으로 보인다.",
    when: "매번 같은 플랫폼에 올리는 크리에이터가 설정 고민 없이 내보내야 할 때",
    cost: "세부 조정은 Custom으로 한 단계 더 들어가야 한다.",
    component: PresetsVariant,
  },
  {
    name: "Panel",
    axis: "모달 대신 오른쪽 패널이라 편집을 계속하고, 큐에 여러 버전을 쌓아 순서대로 렌더링한다.",
    when: "1080p와 Reels처럼 여러 버전을 한 번에 뽑으며 작업을 이어가야 할 때",
    cost: "화면 폭을 340px 차지하고 설정이 촘촘해 처음엔 낯설다.",
    component: PanelVariant,
  },
  {
    name: "Wizard",
    axis: "What → Where → Render 3단계로 나눠 한 화면에 결정 하나씩, 렌더 화면은 큰 썸네일과 바 하나만.",
    when: "초보 사용자나 저장 위치·파일명까지 챙겨야 하는 흐름일 때",
    cost: "숙련자에겐 클릭이 두 번 더 든다.",
    component: WizardVariant,
  },
  {
    name: "Minimal",
    axis: "작은 팝오버에 해상도와 품질 3단만, 진행률은 상단 바 아래 얇은 줄, 완료는 토스트.",
    when: "대부분 기본값으로 내보내고 편집기에서 시선을 떼지 않아야 할 때",
    cost: "포맷·프레임레이트·구간 같은 세부 옵션이 없다.",
    component: MinimalVariant,
    pickerPosition: "top",
  },
];

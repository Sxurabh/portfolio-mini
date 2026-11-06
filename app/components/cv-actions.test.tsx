import type { ReactElement } from "react";
import { CvActions } from "./cv-actions";

const ownerFixture: ReactElement = <CvActions hasCv={false} isOwner />;
const memberFixture: ReactElement = <CvActions hasCv isOwner={false} />;

void ownerFixture;
void memberFixture;

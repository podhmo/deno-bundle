/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from "npm:preact";

export function Hello(name: string) {
    return (
        <p>Hello {name}</p>
    )
}

/** fragment version */
export function Hello2() {
    return (
        <>
            <p>Hello World</p>
        </>
    );
}
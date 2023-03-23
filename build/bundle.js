
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.57.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/App.svelte generated by Svelte v3.57.0 */

    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let div0;
    	let h1;
    	let t1;
    	let div1;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let div4;
    	let div2;
    	let label1;
    	let t6;
    	let input1;
    	let t7;
    	let div3;
    	let t8;
    	let t9;
    	let t10;
    	let div7;
    	let div5;
    	let label2;
    	let t12;
    	let input2;
    	let t13;
    	let div6;
    	let t14_value = /*interestRate*/ ctx[5].toFixed(2) + "";
    	let t14;
    	let t15;
    	let t16;
    	let div8;
    	let t17;
    	let t18_value = /*formatter*/ ctx[7].format(/*monthlyPayment*/ ctx[4]) + "";
    	let t18;
    	let t19;
    	let div9;
    	let t20;
    	let t21_value = /*formatter*/ ctx[7].format(/*totalPaid*/ ctx[3]) + "";
    	let t21;
    	let t22;
    	let div10;
    	let t23;
    	let t24_value = /*formatter*/ ctx[7].format(/*interestPaid*/ ctx[6]) + "";
    	let t24;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Mortgage Calculator";
    			t1 = space();
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Loan Amount";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			div4 = element("div");
    			div2 = element("div");
    			label1 = element("label");
    			label1.textContent = "Years";
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			div3 = element("div");
    			t8 = text(/*years*/ ctx[1]);
    			t9 = text(" years");
    			t10 = space();
    			div7 = element("div");
    			div5 = element("div");
    			label2 = element("label");
    			label2.textContent = "Interest Rate";
    			t12 = space();
    			input2 = element("input");
    			t13 = space();
    			div6 = element("div");
    			t14 = text(t14_value);
    			t15 = text("%");
    			t16 = space();
    			div8 = element("div");
    			t17 = text("Monthly Payments: ");
    			t18 = text(t18_value);
    			t19 = space();
    			div9 = element("div");
    			t20 = text("Total Paid: ");
    			t21 = text(t21_value);
    			t22 = space();
    			div10 = element("div");
    			t23 = text("Interest Paid: ");
    			t24 = text(t24_value);
    			add_location(h1, file, 23, 4, 655);
    			attr_dev(div0, "class", "row");
    			add_location(div0, file, 22, 2, 633);
    			add_location(label0, file, 27, 4, 778);
    			attr_dev(input0, "min", "1");
    			attr_dev(input0, "placeholder", "Enter loan amount");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "class", "u-full-width");
    			add_location(input0, file, 28, 4, 809);
    			attr_dev(div1, "class", "row");
    			add_location(div1, file, 25, 2, 695);
    			add_location(label1, file, 39, 6, 1080);
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "1");
    			attr_dev(input1, "max", "50");
    			attr_dev(input1, "class", "u-full-width");
    			add_location(input1, file, 40, 6, 1107);
    			attr_dev(div2, "class", "columns six");
    			add_location(div2, file, 37, 4, 985);
    			attr_dev(div3, "class", "columns six outputs svelte-16nqa56");
    			add_location(div3, file, 48, 4, 1248);
    			attr_dev(div4, "class", "row");
    			add_location(div4, file, 36, 2, 963);
    			add_location(label2, file, 53, 6, 1429);
    			attr_dev(input2, "type", "range");
    			attr_dev(input2, "min", "1");
    			attr_dev(input2, "max", "2000");
    			attr_dev(input2, "class", "u-full-width");
    			add_location(input2, file, 54, 6, 1464);
    			attr_dev(div5, "class", "columns six");
    			add_location(div5, file, 51, 4, 1334);
    			attr_dev(div6, "class", "columns six outputs svelte-16nqa56");
    			add_location(div6, file, 62, 4, 1619);
    			attr_dev(div7, "class", "row");
    			add_location(div7, file, 50, 2, 1312);
    			attr_dev(div8, "class", "row outputs svelte-16nqa56");
    			add_location(div8, file, 65, 2, 1697);
    			attr_dev(div9, "class", "row outputs svelte-16nqa56");
    			add_location(div9, file, 66, 2, 1783);
    			attr_dev(div10, "class", "row outputs svelte-16nqa56");
    			add_location(div10, file, 67, 2, 1858);
    			attr_dev(main, "class", "container");
    			add_location(main, file, 21, 0, 606);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, h1);
    			append_dev(main, t1);
    			append_dev(main, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t3);
    			append_dev(div1, input0);
    			set_input_value(input0, /*loanAmount*/ ctx[0]);
    			append_dev(main, t4);
    			append_dev(main, div4);
    			append_dev(div4, div2);
    			append_dev(div2, label1);
    			append_dev(div2, t6);
    			append_dev(div2, input1);
    			set_input_value(input1, /*years*/ ctx[1]);
    			append_dev(div4, t7);
    			append_dev(div4, div3);
    			append_dev(div3, t8);
    			append_dev(div3, t9);
    			append_dev(main, t10);
    			append_dev(main, div7);
    			append_dev(div7, div5);
    			append_dev(div5, label2);
    			append_dev(div5, t12);
    			append_dev(div5, input2);
    			set_input_value(input2, /*interestRateInput*/ ctx[2]);
    			append_dev(div7, t13);
    			append_dev(div7, div6);
    			append_dev(div6, t14);
    			append_dev(div6, t15);
    			append_dev(main, t16);
    			append_dev(main, div8);
    			append_dev(div8, t17);
    			append_dev(div8, t18);
    			append_dev(main, t19);
    			append_dev(main, div9);
    			append_dev(div9, t20);
    			append_dev(div9, t21);
    			append_dev(main, t22);
    			append_dev(main, div10);
    			append_dev(div10, t23);
    			append_dev(div10, t24);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[10]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[11]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[11]),
    					listen_dev(input2, "change", /*input2_change_input_handler*/ ctx[12]),
    					listen_dev(input2, "input", /*input2_change_input_handler*/ ctx[12])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*loanAmount*/ 1 && to_number(input0.value) !== /*loanAmount*/ ctx[0]) {
    				set_input_value(input0, /*loanAmount*/ ctx[0]);
    			}

    			if (dirty & /*years*/ 2) {
    				set_input_value(input1, /*years*/ ctx[1]);
    			}

    			if (dirty & /*years*/ 2) set_data_dev(t8, /*years*/ ctx[1]);

    			if (dirty & /*interestRateInput*/ 4) {
    				set_input_value(input2, /*interestRateInput*/ ctx[2]);
    			}

    			if (dirty & /*interestRate*/ 32 && t14_value !== (t14_value = /*interestRate*/ ctx[5].toFixed(2) + "")) set_data_dev(t14, t14_value);
    			if (dirty & /*monthlyPayment*/ 16 && t18_value !== (t18_value = /*formatter*/ ctx[7].format(/*monthlyPayment*/ ctx[4]) + "")) set_data_dev(t18, t18_value);
    			if (dirty & /*totalPaid*/ 8 && t21_value !== (t21_value = /*formatter*/ ctx[7].format(/*totalPaid*/ ctx[3]) + "")) set_data_dev(t21, t21_value);
    			if (dirty & /*interestPaid*/ 64 && t24_value !== (t24_value = /*formatter*/ ctx[7].format(/*interestPaid*/ ctx[6]) + "")) set_data_dev(t24, t24_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let interestRate;
    	let totalPayments;
    	let monthlyInterestRate;
    	let monthlyPayment;
    	let totalPaid;
    	let interestPaid;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	var formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    	let loanAmount = 200000;
    	let years = 15;
    	let interestRateInput = 200;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		loanAmount = to_number(this.value);
    		$$invalidate(0, loanAmount);
    	}

    	function input1_change_input_handler() {
    		years = to_number(this.value);
    		$$invalidate(1, years);
    	}

    	function input2_change_input_handler() {
    		interestRateInput = to_number(this.value);
    		$$invalidate(2, interestRateInput);
    	}

    	$$self.$capture_state = () => ({
    		formatter,
    		loanAmount,
    		years,
    		interestRateInput,
    		totalPaid,
    		interestPaid,
    		totalPayments,
    		monthlyPayment,
    		monthlyInterestRate,
    		interestRate
    	});

    	$$self.$inject_state = $$props => {
    		if ('formatter' in $$props) $$invalidate(7, formatter = $$props.formatter);
    		if ('loanAmount' in $$props) $$invalidate(0, loanAmount = $$props.loanAmount);
    		if ('years' in $$props) $$invalidate(1, years = $$props.years);
    		if ('interestRateInput' in $$props) $$invalidate(2, interestRateInput = $$props.interestRateInput);
    		if ('totalPaid' in $$props) $$invalidate(3, totalPaid = $$props.totalPaid);
    		if ('interestPaid' in $$props) $$invalidate(6, interestPaid = $$props.interestPaid);
    		if ('totalPayments' in $$props) $$invalidate(8, totalPayments = $$props.totalPayments);
    		if ('monthlyPayment' in $$props) $$invalidate(4, monthlyPayment = $$props.monthlyPayment);
    		if ('monthlyInterestRate' in $$props) $$invalidate(9, monthlyInterestRate = $$props.monthlyInterestRate);
    		if ('interestRate' in $$props) $$invalidate(5, interestRate = $$props.interestRate);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*interestRateInput*/ 4) {
    			$$invalidate(5, interestRate = interestRateInput / 100);
    		}

    		if ($$self.$$.dirty & /*years*/ 2) {
    			$$invalidate(8, totalPayments = years * 12);
    		}

    		if ($$self.$$.dirty & /*interestRate*/ 32) {
    			$$invalidate(9, monthlyInterestRate = interestRate / 100 / 12);
    		}

    		if ($$self.$$.dirty & /*loanAmount, monthlyInterestRate, totalPayments*/ 769) {
    			$$invalidate(4, monthlyPayment = loanAmount * Math.pow(1 + monthlyInterestRate, totalPayments) * monthlyInterestRate / (Math.pow(1 + monthlyInterestRate, totalPayments) - 1));
    		}

    		if ($$self.$$.dirty & /*monthlyPayment, totalPayments*/ 272) {
    			$$invalidate(3, totalPaid = monthlyPayment * totalPayments);
    		}

    		if ($$self.$$.dirty & /*totalPaid, loanAmount*/ 9) {
    			$$invalidate(6, interestPaid = totalPaid - loanAmount);
    		}
    	};

    	return [
    		loanAmount,
    		years,
    		interestRateInput,
    		totalPaid,
    		monthlyPayment,
    		interestRate,
    		interestPaid,
    		formatter,
    		totalPayments,
    		monthlyInterestRate,
    		input0_input_handler,
    		input1_change_input_handler,
    		input2_change_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,

    });

    return app;

})();
//# sourceMappingURL=bundle.js.map

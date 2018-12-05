var app=require('express')();
var http=require('http').Server(app);
var io=require('socket.io')(http);
var db=require('./src/db');

//作为socket的键值对存储
var users={};

http.listen(3000,function(){
    console.log('listening on *:3000');
});

io.sockets.on('connection',function (socket) {
    console.log('a user connected');
    socket.on('disconnect',function () {
        console.log('user disconnected');
    });
    //监听到登录事件
    socket.on('login',function (data) {
        //查询数据库，验证账号密码
        db.query('select * from User where account='+data.account,function (res) {
            if(res.length === 1){
                if(res[0].password === data.password){
                    let itsname=res[0].username;
                    //成功登录，存储登录socket键值对
                    if(data.account in users){

                    }else{
                        users[data.account]= socket;
                    }

                    //成功登录，发送账号信息
                    socket.emit('sureLogin',{
                        flag:true,
                        userInfo:{
                            account:res[0].account,
                            username:res[0].username
                        }
                    });

                    //将登录上线信息推送给好友
                    let sqllan1='select * from friend where account in ';
                    sqllan1+='(select friendAccount from friend where account='+data.account+')';
                    sqllan1+=' and friendAccount='+data.account;
                    db.query(sqllan1,function (res2) {
                        for(let item of res2){
                            if(item.account in users){
                                users[item.account].emit('changeOnline',{
                                    flag:1,
                                    groupId:item.groupId,
                                    account:item.friendAccount
                                });
                            }
                        }
                    });

                    //修改账号状态
                    db.query('UPDATE user SET online=1 where account='+data.account,(res2) => {});

                    //获取并发送私信列表
                    //获取朋友列表
                    function sendFriendList(){
                        let sqllan2='select friend.friendAccount,friend.nonRead,user.username,memory.talker,memory.time,memory.msg,memory.memoryId';
                        sqllan2+=' from memory join friend on friend.memoryId=memory.memoryId and friend.account='+data.account;
                        sqllan2+=' join user on friend.friendAccount=user.account';
                        // sqllan2+=' where talker='+data.account;
                        sqllan2+=' order by memory.time desc';
                        db.query(sqllan2,function (res2) {
                            let msgList=[];
                            let friends={};
                            for(let item of res2){
                                if(item.memoryId in friends){
                                }else{
                                    friends[item.memoryId]=item.username;
                                    let thisMsg={};
                                    thisMsg.id=item.friendAccount;
                                    thisMsg.nonRead=item.nonRead;
                                    thisMsg.name=item.username;
                                    thisMsg.lastMsg={};
                                    if(item.talker === data.account){
                                        thisMsg.lastMsg.talker=itsname;
                                    }else{
                                        thisMsg.lastMsg.talker=item.username;
                                    }
                                    var nowTime=new Date().Format('dd/MM/yyyy');
                                    if(nowTime ===item.time.Format('dd/MM/yyyy')){
                                        thisMsg.lastMsg.time=item.time.Format('hh:mm');
                                    }else{
                                        thisMsg.lastMsg.time=item.time.Format('yyyy/MM/dd');
                                    }
                                    thisMsg.lastMsg.msg=item.msg;
                                    msgList.push(thisMsg);
                                }
                            }
                            socket.emit('getMsgList',{
                                msgList:msgList
                            });
                        });
                    }
                    sendFriendList();

                    //获取并发送朋友群组表
                    let sqllan3='select friend.account,friend.groupId,friend.friendAccount,groups.groupName,groups.peopleNum,user.username,user.online';
                    sqllan3+=' from friend join groups on groups.groupId=friend.groupId';
                    sqllan3+=' join user on user.account=friend.friendAccount';
                    sqllan3+=' where friend.account='+data.account;
                    db.query(sqllan3,function (res2) {
                        let groupList=[];
                        let groups={};
                        for(let item of res2){
                            let thisGroup={};
                            if(item.groupId in groups){
                                for(let index of groupList){
                                    if(index.id === item.groupId){
                                        let thisFriend={};
                                        thisFriend.name=item.username;
                                        thisFriend.id=item.friendAccount;
                                        if(item.online === 1){
                                            groups[item.groupId]+=1;
                                        }
                                        index.peopleList.push(thisFriend);
                                    }
                                }
                            }else{
                                groups[item.groupId]=0;
                                thisGroup.id=item.groupId;
                                thisGroup.groupName=item.groupName
                                thisGroup.peopleNum=item.peopleNum;
                                thisGroup.peopleList=[];
                                let thisFriend={};
                                thisFriend.name=item.username;
                                thisFriend.id=item.friendAccount;
                                if(item.online === 1){
                                    groups[item.groupId]+=1;
                                }
                                thisGroup.peopleList.push(thisFriend);
                                groupList.push(thisGroup);
                            }
                        }
                        for(let item of groupList){
                            item.onlineNum=groups[item.id];
                        }
                        socket.emit('getGroupList',{
                            groupList:groupList
                        });
                    });

                    //获取并发送群组列表
                    function getCrowdList(){
                        let sqllan='select id,name from crowds where id in ';
                        sqllan+='(select crowdId from crowdPeople where account='+data.account+')';
                        db.query(sqllan,function (res2) {
                           if(res2.length >= 1){
                               let crowdList=[];
                               for(let item of res2){
                                   crowdList.push({
                                       id:item.id,
                                       name:item.name
                                   });
                               }
                               socket.emit('getCrowdList',{
                                   crowdList:crowdList
                               });
                           }
                        });
                    }
                    getCrowdList();

                    //获取并发送群组消息列表
                    function sendCrowdMsg(){
                        let sqllan='select crowds.id,crowds.name,crowdPeople.nonRead,user.username,memory.talker,memory.time,memory.msg,memory.memoryId ';
                        sqllan+='from crowdPeople join crowds on crowdPeople.crowdId=crowds.id ';
                        sqllan+='join memory on memory.memoryId=crowds.memoryId ';
                        sqllan+='join user on user.account=memory.talker ';
                        sqllan+='where crowdPeople.account='+data.account;
                        sqllan+=' order by memory.time desc';
                        db.query(sqllan,function (res2) {
                            if(res2.length >= 1){
                                let crowdMsg=[];
                                let crowds={};
                                for(let item of res2){
                                    if(item.id in crowds){
                                    }else{
                                        crowds[item.id]=item.name;
                                        let thisMsg={};
                                        thisMsg.id=item.id;
                                        thisMsg.name=item.name;
                                        thisMsg.nonRead=item.nonRead;
                                        thisMsg.lastMsg={};
                                        thisMsg.lastMsg.talker=item.username;

                                        var nowTime=new Date().Format('dd/MM/yyyy');
                                        if(nowTime ===item.time.Format('dd/MM/yyyy')){
                                            thisMsg.lastMsg.time=item.time.Format('hh:mm');
                                        }else{
                                            thisMsg.lastMsg.time=item.time.Format('yyyy/MM/dd');
                                        }
                                        thisMsg.lastMsg.msg=item.msg;

                                        crowdMsg.push(thisMsg);
                                    }
                                }
                                socket.emit('getCrowdMsgList',{
                                    crowdMsg:crowdMsg
                                });
                            }
                        })
                    }
                    sendCrowdMsg();

                    //监听事件，发送私信的历史消息
                    socket.on('getMemory',function (data2,fn) {
                        let sqllan='select * from memory join user on memory.talker=user.account where memoryId in ';
                        sqllan+='(select memoryId from friend where account='+data.account+' and friendAccount='+data2.friendAccount+')';
                        sqllan+=' order by time desc limit '+data2.num;
                        db.query(sqllan,function (res2) {
                            if(res2.length >= 1){
                                let wordList=[];
                                for(let i=res2.length-1;i>=0;i--){
                                    let thisWord={};
                                    let item=res2[i];
                                    thisWord.name=item.username;
                                    var nowTime=new Date().Format('dd/MM/yyyy');
                                    if(nowTime === item.time.Format('dd/MM/yyyy')){
                                        thisWord.time=item.time.Format('hh:mm');
                                    }else{
                                        thisWord.time=item.time.Format('MM-dd');
                                    }

                                    thisWord.msg=item.msg;
                                    wordList.push(thisWord);
                                    if(i === 0){
                                        socket.emit('sendMemory',{
                                            wordList:wordList
                                        });
                                        fn();
                                    }
                                }
                            }
                        });
                        db.query('update friend set nonRead=0 where account='+data.account+' and friendAccount='+data2.friendAccount,function () {
                            sendFriendList();
                        });
                    });

                    //监听事件，发送群组的历史消息
                    socket.on('getMemory2',function (data2,fn) {
                        let sqllan='select * from memory join user on memory.talker=user.account where memoryId in ';
                        sqllan+='(select memoryId from crowds where id='+data2.id+')';
                        sqllan+=' order by time desc limit '+data2.num;
                        db.query(sqllan,function (res2) {
                            if(res2.length >= 1){
                                let wordList=[];
                                for(let i=res2.length-1;i>=0;i--){
                                    let thisWord={};
                                    let item=res2[i];
                                    thisWord.name=item.username;
                                    var nowTime=new Date().Format('dd/MM/yyyy');
                                    if(nowTime === item.time.Format('dd/MM/yyyy')){
                                        thisWord.time=item.time.Format('hh:mm');
                                    }else{
                                        thisWord.time=item.time.Format('MM-dd');
                                    }

                                    thisWord.msg=item.msg;
                                    wordList.push(thisWord);
                                    if(i === 0){
                                        socket.emit('sendMemory',{
                                            wordList:wordList
                                        });
                                        fn();
                                    }
                                }
                            }
                        });
                        db.query('update crowdPeople set nonRead=0 where account='+data.account+' and crowdId='+data2.id,function () {
                            sendCrowdMsg();
                        });
                    });

                    //接收消息并发送给对方
                    socket.on('sendMsg',function (data2) {
                        db.query('select memoryId from friend where account='+data.account+' and friendAccount='+data2.talker,function (res2) {
                            if(res2.length === 1){
                                db.query('insert into memory(memoryId,talker,msg) values('+res2[0].memoryId+',"'+data.account+'","'+data2.msg+'")',function () {
                                    socket.emit('gotMsg',{
                                        flag:true
                                    });
                                    if(data2.talker in users){
                                        users[data2.talker].emit('reciveMsg',{
                                            flag:true
                                        })
                                    }
                                    db.query('update friend set nonRead=nonRead+1 where account='+data2.talker+' and friendAccount='+data.account,function () {
                                        if(data2.talker in users){
                                            users[data2.talker].emit('changeMsgList');
                                        }
                                    });
                                    sendFriendList();
                                });
                            }
                        })
                    });

                    //接收群组消息并分发给群组好友
                    socket.on('sendMsg2',function (data2) {
                        db.query('select memoryId from crowds where id='+data2.talker,function (res2) {
                            if(res2.length === 1){
                                db.query('insert into memory(memoryId,talker,msg) values('+res2[0].memoryId+',"'+data.account+'","'+data2.msg+'")',function () {
                                    //告知TBN组件发送消息成功
                                    socket.emit('gotMsg',{
                                        flag:true
                                    });
                                    //推送消息给其他人
                                    db.query('select account from crowdPeople where crowdId='+data2.talker,function (res3) {
                                       if(res3.length >= 1){
                                           for(let item of res3){
                                               if(item.account !== data.account){
                                                   if(item.account in users){
                                                       users[item.account].emit('reciveMsg',{
                                                           flag:true
                                                       });
                                                       db.query('update crowdPeople set nonRead=nonRead+1 where account='+item.account+' and crowdId='+data2.talker,function () {
                                                           users[item.account].emit('changeCrowdMsg');
                                                       });
                                                   }
                                               }
                                           }
                                           sendCrowdMsg();
                                       }
                                    });
                                });
                            }
                        })
                    })

                    //刷新信息列表
                    socket.on('wantMsgList',function () {
                        sendFriendList();
                    });
                    socket.on('wantCrowdMsg',function () {
                        sendCrowdMsg();
                    });

                    //关闭连接的时候改变账号状态
                    socket.on('disconnect',function () {
                        //将账号状态修改推送给各个好友
                        let sqllan='select * from friend where account in ';
                        sqllan+='(select friendAccount from friend where account='+data.account+')';
                        sqllan+=' and friendAccount='+data.account;
                        db.query(sqllan,function (res2) {
                            for(let item of res2){
                                if(item.account in users){
                                    users[item.account].emit('changeOnline',{
                                        flag:0,
                                        groupId:item.groupId,
                                        account:item.friendAccount
                                    });
                                }
                            }
                        });

                        db.query('UPDATE user SET online=0 where account='+data.account,(res2) => {});
                        delete users[data.account];
                    });

                }else{
                    socket.emit('sureLogin',{
                        flag:false,
                        msg:'密码错误！'
                    });
                }
            }else{
                socket.emit('sureLogin',{
                    flag:false,
                    msg:'不存在此用户！'
                });
            }
        })
    });
})

//时间格式转换
Date.prototype.Format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1, //Month
        "d+": this.getDate(), //Day
        "h+": this.getHours(), //Hour
        "m+": this.getMinutes(), //Minute
        "s+": this.getSeconds(), //Second
        "q+": Math.floor((this.getMonth() + 3) / 3), //Season
        "S": this.getMilliseconds() //millesecond
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
};
